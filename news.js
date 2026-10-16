// ข่าวและเทรนด์จากข้างนอก ที่ Bell รวบรวมให้ Ize (ภาพนิ่ง ณ วันที่ updated ไม่ใช่ข่าวสด)
// ⚠️ ไฟล์นี้ขึ้นเว็บสาธารณะ: ใส่เฉพาะข้อมูลสาธารณะพร้อมแหล่งที่มา ห้ามใส่ข้อมูลของ Ize (ต้นทุน ยอดชม ออเดอร์ ค่าคอม ลิงก์ส่วนตัว)
// trust: "official" = มาจากหน้าทางการของแพลตฟอร์ม · "secondary" = บทความของคนอื่น ยังไม่ยืนยันกับหน้าทางการ
// dept: "facebook" | "youtube" | "tiktok" | "shopee" | "all"
window.STUDIO_NEWS = {
  updated: "2026-10-17",
  // เทรนด์ตลาด: ข้อมูลสาธารณะที่ Bell ค้นมา เป็นแค่ทิศทาง ไม่ใช่ยอดขายจริง (ยอดจริงรายสินค้าอยู่หลังล็อกอินหรือในเครื่องมือเสียเงิน)
  // trends.depts = แผนกที่แสดงส่วนนี้ (ดู All ก็แสดง) · categories[].items[].k = รหัสหมวด ถ้าตรงกันทุกแพลตฟอร์มจะถูกไฮไลต์ว่าตรงกัน
  trends: {
    depts: ["shopee", "tiktok"],
    categories: [
      {
        platform: "TikTok Shop ไทย", note: "ประมาณการโดย EchoTik สัปดาห์ 3-9 ส.ค. 2026", trust: "secondary",
        url: "https://www.echotik.live/blog/tiktok-shop-weekly-report-august-3-9-2026/",
        items: [{ k: "food", t: "อาหาร/เครื่องดื่ม" }, { k: "health", t: "สุขภาพ" }, { k: "beauty", t: "ความงาม" }, { k: "home", t: "ของใช้ในบ้าน" }, { k: "furniture", t: "เฟอร์นิเจอร์" }, { k: "electronics", t: "อิเล็กทรอนิกส์" }]
      },
      {
        platform: "Shopee ไทย", note: "ยอดใช้จ่ายของลูกค้าบัตร KTC ม.ค.-มิ.ย. 2026", trust: "secondary",
        url: "https://www.ktc.co.th/en/news/product-and-service/online-shopping-daily-life",
        items: [{ k: "home", t: "ของใช้ในบ้าน" }, { k: "beauty", t: "ความงาม" }, { k: "appliances", t: "เครื่องใช้ไฟฟ้า" }, { k: "health", t: "สุขภาพ" }, { k: "food", t: "อาหารแห้ง/เครื่องดื่ม" }]
      }
    ],
    catNote: "ของใช้สัตว์เลี้ยงไม่อยู่ในรายการต้น ๆ ของทั้งสองแหล่ง แต่รายการนี้นับแบบกว้าง ไม่ได้แปลว่าขายไม่ได้",
    formats: [
      { big: "2 วิแรก", t: "โชว์สินค้าหรือปัญหาให้เห็นทันที", trust: "secondary", src: "Mavely", url: "https://www.joinmavely.com/blog/how-to-do-affiliate-marketing-tiktok/" },
      { big: "UGC", t: "สไตล์คนใช้จริง ชนะคลิปที่แบรนด์ทำเอง", trust: "secondary", src: "Mavely", url: "https://www.joinmavely.com/blog/how-to-do-affiliate-marketing-tiktok/" },
      { big: "12-18 วิ", t: "ความยาวที่ผู้ขายเครื่องมือแนะนำ ควรลองเทียบเอง", trust: "secondary", src: "EchoTik", url: "https://www.echotik.live/blog/tiktok-short-video-viral-strategies/" },
      { big: "คลิป > ไลฟ์", t: "ในสหรัฐฯ คลิปปักตะกร้าสร้างยอดราว 70% ไลฟ์ราว 17%", trust: "secondary", src: "Hubfluence", url: "https://www.hubfluence.io/blog/tiktok-shop-content-formats" }
    ],
    caveat: "ข้อมูลฟรีบอกได้แค่ทิศทาง ไม่มีสูตรรับประกันไวรัล ให้ใช้ผลของเราเอง (เทียบรูปแบบคลิป) เป็นตัวตัดสิน"
  },
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
