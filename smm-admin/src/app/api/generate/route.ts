import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceAccess } from "@/lib/workspace-access";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const GROQ_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export interface GenerateInput {
  workspace: string;
  postType: string;   // showcase | tips | before_after | materials | promo | story
  room?: string;      // kitchen | bathroom | living | bedroom | office | exterior
  style?: string;     // minimalism | scandinavian | loft | modern_classic | neoclassic
  tone?: string;      // inspiring | educational | conversational | promotional
  platforms?: string[];
  projectDetails?: string;  // free text: what the project is about
  budget?: string;    // budget range in BYN
}

export interface GenerateResult {
  variants: {
    caption: string;
    hashtags: string[];
    visualPrompt: string;
  }[];
  postType: string;
  platform: string;
}

const POST_TYPES: Record<string, string> = {
  showcase: "Показ готового проекта",
  tips: "Советы и лайфхаки",
  before_after: "До/после ремонта",
  materials: "Обзор материалов",
  promo: "Акция / спецпредложение",
  story: "История клиента / кейс",
};

const ROOMS: Record<string, string> = {
  kitchen: "кухня",
  bathroom: "ванная",
  living: "гостиная",
  bedroom: "спальня",
  office: "кабинет/офис",
  exterior: "фасад/экстерьер",
  "": "помещение",
};

const STYLES: Record<string, string> = {
  minimalism: "минимализм",
  scandinavian: "скандинавский стиль",
  loft: "лофт",
  modern_classic: "современная классика",
  neoclassic: "неоклассика",
  "": "современный стиль",
};

const TONES: Record<string, string> = {
  inspiring: "вдохновляющий, эмоциональный",
  educational: "экспертный, обучающий",
  conversational: "живой, дружелюбный, разговорный",
  promotional: "продающий, с призывом к действию",
  "": "профессиональный",
};

function buildSystemPrompt(): string {
  return `Ты — опытный SMM-копирайтер студии дизайна интерьеров Morrow Lab. 
Пишешь на русском языке. Специализируешься на контенте для Instagram, TikTok, ВКонтакте и Telegram.
Morrow Lab — AI-студия дизайна интерьеров: ванные, кухни, гостиные, спальни, офисы. Стили: минимализм, скандинавский, лофт, современная классика.
Цены в BYN. Клиенты — владельцы жилья и коммерческой недвижимости в СНГ.
Твои тексты всегда: конкретные (без воды), с живыми деталями, оригинальные.`;
}

function buildUserPrompt(input: GenerateInput): string {
  const postTypeLabel = POST_TYPES[input.postType] ?? input.postType;
  const roomLabel = ROOMS[input.room ?? ""] ?? "помещение";
  const styleLabel = STYLES[input.style ?? ""] ?? "современный стиль";
  const toneLabel = TONES[input.tone ?? ""] ?? "профессиональный";
  const platform = (input.platforms ?? ["instagram"])[0];

  const safePlatform = /^[a-zA-Z]{2,20}$/.test(platform) ? platform : "instagram";
  let ctx = `Тип поста: ${postTypeLabel}\nКомната: ${roomLabel}\nСтиль: ${styleLabel}\nТон: ${toneLabel}\nПлатформа: ${safePlatform}`;
  if (input.budget) ctx += `\nБюджет: ${String(input.budget).slice(0, 50)} BYN`;
  if (input.projectDetails) ctx += `\nДетали проекта: ${String(input.projectDetails).slice(0, 2000)}`;

  const maxLen = platform === "telegram" ? 800 : platform === "tiktok" ? 300 : 500;

  return `${ctx}

Напиши 3 разных варианта подписи к посту (каждый вариант — отдельный текст, не нумеруй их внутри, пиши сразу текст). 
Для каждого варианта:
- Подпись: до ${maxLen} символов, без хештегов внутри текста
- 12–20 хештегов: микс из популярных (#дизайнинтерьера), нишевых (#ваннаяминимализм) и брендовых (#morrowlab)
- Визуальный промпт: 1–2 предложения что должно быть на фото/видео для этого поста

Формат ответа — строго JSON без markdown:
{
  "variants": [
    {
      "caption": "текст подписи",
      "hashtags": ["#тег1", "#тег2"],
      "visualPrompt": "описание для фото"
    },
    ...
  ]
}`;
}

export async function POST(req: NextRequest) {
  const ip = (await headers()).get("x-forwarded-for") ?? "unknown";
  if (!rateLimit("generate:" + ip, 10, 60000)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const input: GenerateInput = await req.json();

  if (!input.workspace || !input.postType) {
    return NextResponse.json({ error: "workspace и postType обязательны" }, { status: 400 });
  }

  const access = await checkWorkspaceAccess(input.workspace);
  if (!access) {
    return NextResponse.json({ error: "Нет доступа к workspace" }, { status: 403 });
  }

  if (!GROQ_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY не настроен" }, { status: 500 });
  }

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(input) },
        ],
        max_tokens: 2000,
        temperature: 0.85,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      const err = (await groqRes.text()).slice(0, 200).replace(/[\n\r]/g, ' ');
      throw new Error(`Groq error ${groqRes.status}: ${err}`);
    }

    const groqData = await groqRes.json() as {
      choices: { message: { content: string } }[];
    };

    const raw = groqData.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { variants?: GenerateResult["variants"] };

    if (!parsed.variants || !Array.isArray(parsed.variants)) {
      throw new Error("Неожиданный формат ответа от AI");
    }

    const result: GenerateResult = {
      variants: parsed.variants.slice(0, 3),
      postType: input.postType,
      platform: (input.platforms ?? ["instagram"])[0],
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error("generate error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
