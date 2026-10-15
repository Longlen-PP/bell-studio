// Bell Studio — source of truth ของ Dashboard (แก้ไฟล์นี้ไฟล์เดียวพอ)
// ⚠️ เว็บนี้เป็นสาธารณะ: ห้ามใส่รายได้ ยอดคอมมิชชั่น ลิงก์ affiliate ส่วนตัว หรือข้อมูลบัญชี
//
// stage ของ pipeline: "idea" = ไอเดีย · "doing" = กำลังทำ · "done" = ลงแล้ว
// status ของช่อง/สินค้า: "active" = ใช้งานอยู่ · "planned" = วางแผน · "paused" = พัก · "unconfirmed" = รอยืนยัน

window.STUDIO = {
  updated: "2026-10-15",
  company: {
    name: "Bell Studio",
    tagline: "บริษัท Content จำลองของ Ize — แบ่งงานตามแพลตฟอร์ม"
  },

  ceo: {
    name: "เบล",
    title: "CEO",
    emoji: "👩‍💼",
    persona: "เลขาคนสนิทของ Ize ผู้กำกับและนักตัดต่อที่ตามเทรนด์ตลอด",
    duties: [
      "รับโจทย์และไอเดียจาก Ize แล้วส่งต่อให้แผนกที่ใช่",
      "ถ้าไม่ชัดว่าเป็นงานแผนกไหน ถาม Ize ก่อน",
      "สรุปงานให้ Ize และอัปเดต Dashboard นี้",
      "ดูแลกฎข้ามแผนกและความเสี่ยงของแพลตฟอร์ม"
    ]
  },

  departments: [
    {
      id: "facebook",
      name: "Facebook",
      emoji: "📘",
      head: { name: "Luna", gender: "ญ", emoji: "🎭", persona: "นักเล่าเรื่องสายดราม่า อินกับตัวละคร เข้าใจคนดูเพจไทย" },
      mission: "ละครแนวตั้ง ซีรีส์ดราม่า สเก็ตช์ตลก",
      roles: [
        { title: "คนเขียนบท", duty: "พล็อต บทพูด cliffhanger ปิดแต่ละตอน" },
        { title: "ผู้กำกับ prompt", duty: "Character/Location Sheet และ prompt ภาพกับวิดีโอ" },
        { title: "คนตัดต่อ & ดูแลเพจ", duty: "ตัดต่อ แคปชัน และตารางโพสต์" }
      ],
      skills: ["short-drama-blueprint", "fruit-drama-series", "comedy-short-script", "thai-costume-parody-series"],
      rules: ["ติดป้ายเนื้อหา AI ตามกฎ Meta", "ห้ามใช้ชื่อหรือหน้าคนดังจริง"]
    },
    {
      id: "youtube",
      name: "YouTube",
      emoji: "▶️",
      head: { name: "Shadow", gender: "ช", emoji: "📚", persona: "นักเล่าเรื่องใจเย็น ละเอียด ชอบประวัติศาสตร์และงานเด็ก" },
      mission: "เล่าเรื่อง สารคดี เพลงเด็ก",
      roles: [
        { title: "คนเขียนสคริปต์ & พากย์", duty: "สคริปต์ยาว และจังหวะเสียงพากย์" },
        { title: "ฝ่ายภาพ", duty: "Style Bible, Shot List และ prompt ภาพ" },
        { title: "SEO & ตั้งช่อง", duty: "ชื่อช่อง คำอธิบาย แท็ก และปก" }
      ],
      skills: ["stick-figure-storytelling", "history-documentary-blueprint", "kids-channel-setup-prompts", "kids-mv-song-prompt", "kids-3d-cartoon-prompt"],
      rules: ["คอนเทนต์เด็กต้องตั้ง Made for Kids และใช้กฎปลอดภัยเด็ก", "ติดป้าย altered/synthetic content"]
    },
    {
      id: "tiktok",
      name: "TikTok",
      emoji: "🎵",
      head: { name: "Queen", gender: "ญ", emoji: "💃", persona: "สายแฟชั่น ไวกับเทรนด์ รู้ว่าคลิปไหนหยุดนิ้วคนดู" },
      mission: "AI Influencer แฟชั่น/ลุคสวย และคลิปไม่ออกกล้อง",
      roles: [
        { title: "ฝ่ายสร้างตัวตน AI", duty: "ออกแบบ AI Influencer ที่ใช้ซ้ำได้" },
        { title: "ผู้กำกับภาพ", duty: "prompt ภาพแบบ cinematic และลุคแฟชั่น" },
        { title: "คนโพสต์ & ดูเทรนด์", duty: "เสียงเพลงที่กำลังมา แฮชแท็ก และเวลาโพสต์" }
      ],
      skills: ["ai-influencer-identity", "cinematic-prompt", "asmr-craft-storyboard", "skeleton-seller-ads"],
      rules: ["แฟชั่น/ลุคสวยเท่านั้น ห้ามเนื้อหาวาบหวิว", "คน AI ทุกตัวต้องติดป้าย AI-generated", "คลิปขายของเป็นของแผนก Shopee (TikTok ช่วยโพสต์)"]
    },
    {
      id: "shopee",
      name: "Shopee",
      emoji: "🛒",
      head: { name: "Axe", gender: "ช", emoji: "📦", persona: "นักขายสายตัวเลข คัดสินค้าเก่ง ไม่เคลมเกินจริง" },
      mission: "ปักตะกร้า Affiliate และ Shopee Video (เป็นเจ้าของคลิปขายของทุกแพลตฟอร์ม)",
      roles: [
        { title: "ฝ่ายคัดสินค้า", duty: "เลือกสินค้า เช็คราคาและค่าคอมก่อนทำ" },
        { title: "คนเขียนสคริปต์ขาย", duty: "Hook, Content และ CTA ปักตะกร้า" },
        { title: "ฝ่ายภาพสินค้า", duty: "prompt ภาพมือถือสินค้าและคลิป UGC" }
      ],
      skills: ["affiliate-script-master", "affiliate-image-prompt", "thai-social-commerce-script", "ugc-ad-producer", "ugc-review-image-prompt", "video-ad-prompt-blueprint", "object-swap-video-lock"],
      rules: ["ติดตะกร้าก่อนโพสต์", "เปิดป้าย AI", "ห้ามรีวิวปลอมหรือเคลมเกินฉลาก", "ราคาต้องเช็คซ้ำวันโพสต์"]
    }
  ],

  channels: [
    { dept: "shopee", name: "Shopee Video (Affiliate)", status: "active", note: "ลง Kasty Tofu 20L แล้ว" },
    { dept: "tiktok", name: "TikTok Affiliate", status: "unconfirmed", note: "เริ่ม 2026-10-02 — รอ Ize ยืนยันว่ายังใช้อยู่" }
  ],

  pipeline: [
    { dept: "shopee", title: "Kasty Tofu 20L — คลิปขาย 30 วิ", stage: "done", updated: "2026-10-15", note: "Hand Talent + Gemini Omni Flash ลง Shopee Video" }
  ],

  products: [
    { dept: "shopee", name: "Kasty Tofu Cat Litter 20L Original", platform: "Shopee Video", status: "active", updated: "2026-10-15" }
  ]
};
