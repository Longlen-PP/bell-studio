// Bell Studio — source of truth ของ Dashboard (แก้ไฟล์นี้ไฟล์เดียวพอ)
// ⚠️ เว็บนี้เป็นสาธารณะ: ห้ามใส่รายได้ ยอดคอมมิชชั่น ลิงก์ affiliate ส่วนตัว หรือข้อมูลบัญชี
//
// โครงข้อมูล (v2): แผนก → ช่อง → งาน → ตอน/คลิป
//   channels[].type  = "affiliate" | "series" | "mv" | "story" | "live"   (ตัดสินว่างานในช่องนั้นต้องกรอกอะไร)
//   works[]          = งาน 1 ชิ้น: สินค้า (affiliate) · เรื่อง (series) · เพลง (mv) · เรื่องเล่า (story) · รอบไลฟ์ (live)
//                      props = ฟิลด์เฉพาะประเภท · characters/locations = เฉพาะประเภทที่มี · rules = กฎความต่อเนื่อง (series)
//   รหัส: แผนก.code - ช่อง.code - งาน.no (3 หลัก) - ตัวอักษรชนิด+ตอน.n (2 หลัก) เช่น SHP-AFF-001-C01 (C=Clip E=EP V=Video S=Session)
//         ช่อง.seq = ตัวนับเลขงานของช่อง (เลขงานไม่ถูกใช้ซ้ำแม้ลบงานทิ้ง)
//   formats          = ตัวอย่างรูปแบบคลิป (template กลุ่ม) ต่อประเภทช่อง ขึ้นเป็นตัวเลือกในช่อง "รูปแบบ" ของตอน พิมพ์เองได้ และที่เคยใช้แล้วจะขึ้นให้เลือกซ้ำ
//   episodes[]       = ตอน/คลิป/รอบ ของงาน: n = ลำดับ · format = รูปแบบ/template ที่ใช้เป็นชื่อของตอน · title = ชื่อเรียกเพิ่ม (ไม่บังคับ) · stage = idea | script | producing | editing | published
//   รูป/ลิงก์ (cover, image, link) = ลิงก์แชร์ Google Drive หรือ URL https — เว้นว่างได้
// platforms ของแผนก = ตัวเลือกใน dropdown ตอนสร้างช่อง (แก้ได้ในหน้าแก้ไขแผนก)
// status ของช่อง: "active" = ใช้งานอยู่ (ค่าตั้งต้น) · "paused" = พัก

window.STUDIO = {
  v: 2,
  updated: "2026-10-16",
  company: {
    name: "Bell Studio",
    tagline: "บริษัท Content จำลองของ Ize — แบ่งงานตามแพลตฟอร์ม"
  },

  ceo: {
    name: "Bell",
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
      code: "FBK",
      name: "Facebook",
      emoji: "📘",
      head: { name: "Luna", gender: "ญ", emoji: "🎭", persona: "นักเล่าเรื่องสายดราม่า อินกับตัวละคร เข้าใจคนดูเพจไทย" },
      mission: "ละครแนวตั้ง ซีรีส์ดราม่า สเก็ตช์ตลก",
      roles: [
        { title: "คนเขียนบท", duty: "พล็อต บทพูด cliffhanger ปิดแต่ละตอน" },
        { title: "ผู้กำกับ prompt", duty: "Character/Location Sheet และ prompt ภาพกับวิดีโอ" },
        { title: "คนตัดต่อ & ดูแลเพจ", duty: "ตัดต่อ แคปชัน และตารางโพสต์" }
      ],
      platforms: ["Facebook", "Facebook Reels"],
      skills: ["short-drama-blueprint", "fruit-drama-series", "comedy-short-script", "thai-costume-parody-series"],
      rules: ["ติดป้ายเนื้อหา AI ตามกฎ Meta", "ห้ามใช้ชื่อหรือหน้าคนดังจริง"]
    },
    {
      id: "youtube",
      code: "YTB",
      name: "YouTube",
      emoji: "▶️",
      head: { name: "Shadow", gender: "ช", emoji: "📚", persona: "นักเล่าเรื่องใจเย็น ละเอียด ชอบประวัติศาสตร์และงานเด็ก" },
      mission: "เล่าเรื่อง สารคดี เพลงเด็ก",
      roles: [
        { title: "คนเขียนสคริปต์ & พากย์", duty: "สคริปต์ยาว และจังหวะเสียงพากย์" },
        { title: "ฝ่ายภาพ", duty: "Style Bible, Shot List และ prompt ภาพ" },
        { title: "SEO & ตั้งช่อง", duty: "ชื่อช่อง คำอธิบาย แท็ก และปก" }
      ],
      platforms: ["YouTube", "YouTube Shorts"],
      skills: ["stick-figure-storytelling", "history-documentary-blueprint", "kids-channel-setup-prompts", "kids-mv-song-prompt", "kids-3d-cartoon-prompt"],
      rules: ["คอนเทนต์เด็กต้องตั้ง Made for Kids และใช้กฎปลอดภัยเด็ก", "ติดป้าย altered/synthetic content"]
    },
    {
      id: "tiktok",
      code: "TTK",
      name: "TikTok",
      emoji: "🎵",
      head: { name: "Queen", gender: "ญ", emoji: "💃", persona: "สายแฟชั่น ไวกับเทรนด์ รู้ว่าคลิปไหนหยุดนิ้วคนดู" },
      mission: "AI Influencer แฟชั่น/ลุคสวย และคลิปไม่ออกกล้อง",
      roles: [
        { title: "ฝ่ายสร้างตัวตน AI", duty: "ออกแบบ AI Influencer ที่ใช้ซ้ำได้" },
        { title: "ผู้กำกับภาพ", duty: "prompt ภาพแบบ cinematic และลุคแฟชั่น" },
        { title: "คนโพสต์ & ดูเทรนด์", duty: "เสียงเพลงที่กำลังมา แฮชแท็ก และเวลาโพสต์" }
      ],
      platforms: ["TikTok"],
      skills: ["ai-influencer-identity", "cinematic-prompt", "asmr-craft-storyboard", "skeleton-seller-ads"],
      rules: ["แฟชั่น/ลุคสวยเท่านั้น ห้ามเนื้อหาวาบหวิว", "คน AI ทุกตัวต้องติดป้าย AI-generated", "คลิปขายของเป็นของแผนก Shopee (TikTok ช่วยโพสต์)"]
    },
    {
      id: "shopee",
      code: "SHP",
      name: "Shopee",
      emoji: "🛒",
      head: { name: "Axe", gender: "ช", emoji: "📦", persona: "นักขายสายตัวเลข คัดสินค้าเก่ง ไม่เคลมเกินจริง" },
      mission: "ปักตะกร้า Affiliate และ Shopee Video (เป็นเจ้าของคลิปขายของทุกแพลตฟอร์ม)",
      roles: [
        { title: "ฝ่ายคัดสินค้า", duty: "เลือกสินค้า เช็คราคาและค่าคอมก่อนทำ" },
        { title: "คนเขียนสคริปต์ขาย", duty: "Hook, Content และ CTA ปักตะกร้า" },
        { title: "ฝ่ายภาพสินค้า", duty: "prompt ภาพมือถือสินค้าและคลิป UGC" }
      ],
      platforms: ["Shopee Video", "Shopee Live"],
      skills: ["affiliate-script-master", "affiliate-image-prompt", "thai-social-commerce-script", "ugc-ad-producer", "ugc-review-image-prompt", "video-ad-prompt-blueprint", "object-swap-video-lock"],
      rules: ["ติดตะกร้าก่อนโพสต์", "เปิดป้าย AI", "ห้ามรีวิวปลอมหรือเคลมเกินฉลาก", "ราคาต้องเช็คซ้ำวันโพสต์"]
    }
  ],

  // ---- ช่อง / งาน / ตอน ----
  channels: [
    {
      id: "affiliate", code: "AFF", seq: 1, dept: "shopee", name: "Affiliate", platform: "Shopee Video", type: "affiliate", status: "active",
      concept: "ช่องขายของปักตะกร้า เริ่ม 2026-10-02", audience: "", schedule: "", url: ""
    }
  ],

  formats: {
    affiliate: ["คลิปรีวิวเห็นเฉพาะสินค้า", "คลิปรีวิวมีคนใช้สินค้า", "คลิปสาธิตการใช้งาน", "คลิปเปิดกล่อง", "คลิปเปรียบเทียบ"],
    series: ["ตอนปกติ", "ตอนพิเศษ", "ตัวอย่าง (Trailer)"],
    mv: ["เวอร์ชันเต็ม", "เวอร์ชันสั้น"],
    story: ["ตอนเต็ม", "คลิปสั้น"],
    live: ["ไลฟ์ขายของ", "ไลฟ์พิเศษ"]
  },

  works: [
    {
      id: "kasty-tofu-20l", no: 1, channel: "affiliate", title: "Kasty Tofu Cat Litter 20L Original",
      summary: "", cover: "", props: { category: "ทรายแมว" }, characters: [], locations: [], rules: "", note: "", updated: "2026-10-15"
    }
  ],

  episodes: [
    {
      id: "kasty-tofu-20l-1", work: "kasty-tofu-20l", n: 1, format: "คลิปรีวิวเห็นเฉพาะสินค้า", title: "", summary: "", stage: "published",
      date: "", link: "", note: "Hand Talent + Gemini Omni Flash ลง Shopee Video", updated: "2026-10-15"
    }
  ]
};
