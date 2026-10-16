// ข่าวและเทรนด์จากข้างนอก ที่ Bell รวบรวมให้ Ize (ภาพนิ่ง ณ วันที่ updated ไม่ใช่ข่าวสด)
// ⚠️ ไฟล์นี้ขึ้นเว็บสาธารณะ: ใส่เฉพาะข้อมูลสาธารณะพร้อมแหล่งที่มา ห้ามใส่ข้อมูลของ Ize (ต้นทุน ยอดชม ออเดอร์ ค่าคอม ลิงก์ส่วนตัว)
// trust: "official" = มาจากหน้าทางการของแพลตฟอร์ม · "secondary" = บทความของคนอื่น ยังไม่ยืนยันกับหน้าทางการ
// dept: "facebook" | "youtube" | "tiktok" | "shopee" | "all"
window.STUDIO_NEWS = {
  updated: "2026-10-17",
  items: [
    {
      dept: "facebook", date: "2026-03", trust: "official",
      title: "Meta ให้รางวัลเนื้อหาต้นฉบับ",
      summary: "Facebook ให้การเข้าถึงและโอกาสสร้างรายได้กับเนื้อหาต้นฉบับมากขึ้น ส่วนโพสต์ที่แค่อัปโหลดซ้ำหรือแก้เล็กน้อย (ใส่กรอบ ใส่แคปชัน ปรับความเร็ว) อาจถูกลดการเข้าถึง และบัญชีที่ทำซ้ำบ่อยอาจเสียสิทธิ์แนะนำและสิทธิ์รายได้",
      source: "Meta Newsroom", url: "https://about.fb.com/news/2026/03/rewarding-original-creators-on-facebook/"
    },
    {
      dept: "youtube", date: "2025-07", trust: "secondary",
      title: "YouTube ย้ำกฎเนื้อหา \"ไม่แท้\" (inauthentic content)",
      summary: "กฎมุ่งไปที่เนื้อหาที่ผลิตซ้ำเป็นจำนวนมาก ไม่ได้ห้ามการใช้ AI และช่องที่ใช้ AI ยังสมัครรับรายได้ได้ แต่เนื้อหาสมจริงที่สร้างหรือแก้ด้วย AI ต้องกดป้าย altered/synthetic ใน YouTube Studio แหล่งข่าวบางที่ลงวันที่ต่างกัน ควรเช็คหน้านโยบาย Partner Program ของ YouTube",
      source: "eWeek", url: "https://www.eweek.com/news/youtube-responds-to-ai-concerns/"
    },
    {
      dept: "tiktok", date: "", trust: "secondary",
      title: "TikTok ให้ติดป้ายเนื้อหาที่สร้างหรือแก้ด้วย AI",
      summary: "บทความสรุปว่าวิดีโอที่ใช้ AI สร้างหรือแก้ภาพคน สถานที่ หรือเหตุการณ์แบบสมจริงควรติดป้าย (เป็นเรื่องการเปิดเผย ไม่ได้ห้าม) ส่วนรายละเอียดอย่างสไลด์จากรูปจริงหรือกฎกับคนจริงมีแหล่งข้อมูลที่ขัดกัน ต้องเช็คกับ Community Guidelines ของ TikTok",
      source: "Cinerads", url: "https://www.cinerads.com/blog/tiktok-ai-content-policy"
    },
    {
      dept: "shopee", date: "2025-06", trust: "official",
      title: "Shopee Affiliate (ไทย) เก็บค่าบริการจากรายได้ของพาร์ทเนอร์",
      summary: "ศูนย์ช่วยเหลือ Shopee ไทยระบุว่าโปรแกรมเริ่มหักค่าบริการจากรายได้ของพาร์ทเนอร์ตั้งแต่ 1 มิถุนายน 2025 ควรเช็คค่าคอมจริงที่หน้าแดชบอร์ดก่อนคำนวณกำไร",
      source: "Shopee Help Center (TH)", url: "https://help.shopee.co.th/10/article/177422-%E0%B8%84%E0%B9%88%E0%B8%B2%E0%B8%9A%E0%B8%A3%E0%B8%B4%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%82%E0%B8%AD%E0%B8%87%E0%B9%82%E0%B8%9B%E0%B8%A3%E0%B9%81%E0%B8%81%E0%B8%A3%E0%B8%A1-Shopee-Affiliate-(Service-Fee)"
    },
    {
      dept: "shopee", date: "2026-01", trust: "official",
      title: "Shopee สิงคโปร์ปรับโปรแกรม Affiliate ใหม่",
      summary: "ศูนย์ช่วยเหลือ Shopee สิงคโปร์ประกาศโครงสร้างค่าคอมใหม่ตั้งแต่ 2 มกราคม 2026 เป็นข่าวของสิงคโปร์ ยังไม่พบประกาศที่ยืนยันว่าไทยปรับตาม ใช้เป็นสัญญาณแนวโน้มเท่านั้น",
      source: "Shopee Help Center (SG)", url: "https://help.shopee.sg/10/article/191914-Commissions-Structure-(W.e.f.-2-January-2026)"
    }
  ]
};
