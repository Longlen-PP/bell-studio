// UI strings in English and Thai. Content typed by Ize/the team is shown as written.
// {name} placeholders are filled by t(key, vars); values are HTML-escaped by the caller unless marked html.
window.BELL_I18N = {
  en: {
    upNext: "Up Next", board: "Board", departments: "Departments", new: "New",
    newIdea: "New idea", newClip: "New clip", newProduct: "New product", newChannel: "New channel",
    editDept: "Edit department", editChannel: "Edit channel", editProduct: "Edit product", editClip: "Edit clip",
    menu: "Menu", close: "Close", langLabel: "Language",

    st_idea: "Idea", st_doing: "In progress", st_done: "Published",
    st_active: "Active", st_planned: "Planned", st_paused: "Paused", st_unconfirmed: "Unconfirmed",

    nextContext: "Bell Studio",
    nextLede: "<strong>{doing} in progress</strong> and <strong>{ideas} waiting</strong> across {channels}.",
    statInProgress: "In progress", statIdeas: "Ideas", statPublished: "Published",
    secInProgress: "In progress", secIdeas: "Ideas", secNeedsChannel: "Needs a channel", secRecent: "Recently published",
    emptyInProgress: "Nothing is in progress. Move an idea forward when you start on it.",
    emptyIdeas: "No ideas waiting.", addIdea: "Add an idea",
    emptyNoChannels: "Add a channel first, then ideas can go into it.",
    emptyPublished: "Nothing published yet.",
    needsChannelRow: "{head} has no channel yet", addChannel: "Add channel",

    boardLede: "Every clip and idea, <strong>by status</strong>.", all: "All", nothingHere: "Nothing here.",

    ledBy: "Led by <strong>{head}</strong>.", statChannels: "Channels", statProducts: "Products", statClipsPublished: "Clips published",
    secChannels: "Channels", secTeam: "Team", secRules: "Rules", secSkills: "Skills",
    noChannelYet: "{head} has no channel yet.", noRoles: "No roles yet.", noRules: "No rules yet.", noSkills: "No skills listed.",

    secProducts: "Products", secOtherClips: "Other clips in this channel",
    clipsOf: "{a} of {b} published", noClipsYet: "No clips yet", noPhoto: "No photo",
    addPhoto: "Add a photo link", photoUnavailable: "Photo unavailable — check the link is shared",
    emptyChannelIdeas: "No ideas yet.",

    statClipsDone: "Clips published", statClipsTotal: "Clips in total", secClips: "Clips", addClip: "Add a clip",
    factStatus: "Status", factChannel: "Channel", factUpdated: "Updated", factNote: "Note",

    f_title: "Title", f_titlePh: "What is the clip or idea?", f_channel: "Channel", f_product: "Product", f_none: "None",
    f_status: "Status", f_note: "Note", f_notePh: "Engine, length, where it goes…",
    f_name: "Name", f_productPh: "Product name", f_channelPh: "Channel or account name",
    f_photo: "Photo link", f_photoHint: "Paste a Google Drive share link (set to “Anyone with the link”) or any https image URL.",
    f_preview: "Photo preview appears here", f_cantLoad: "Can't load this link. Check it is shared with “Anyone with the link”.",
    f_dept: "Department", f_platform: "Platform", f_platformPh: "e.g. YouTube, Shopee Video",
    f_shop: "Sells products", f_shopHint: "Turn on for affiliate or shop channels, so work is organised per product.",
    f_head: "Head", f_persona: "Persona", f_mission: "Mission",
    f_team: "Team", f_teamHint: "One role per line: Role — what they do",
    f_rules: "Rules", f_rulesHint: "One rule per line", f_skills: "Skills", f_skillsHint: "One skill per line",
    editDeptTitle: "Edit {name}",
    save: "Save", cancel: "Cancel", delete: "Delete", deleteWith: "Delete with {what}", confirmDelete: "Confirm delete",
    errTitle: "Give it a title.", errName: "Give it a name.", errHead: "The department needs a head.",

    toastClipAdded: "Clip added", toastClipSaved: "Clip saved", toastClipDeleted: "Clip deleted",
    toastProductAdded: "Product added", toastProductSaved: "Product saved", toastProductDeleted: "Product deleted",
    toastChannelAdded: "Channel added", toastChannelSaved: "Channel saved", toastChannelDeleted: "Channel deleted",
    toastDeptSaved: "Department saved", toastStorage: "Couldn't save — this browser blocked storage",
    toastExported: "Exported — send the file to Bell", toastReset: "Back to the published data",

    ribbon: "Your edits live in this browser only until sign-in sync is connected.",
    export: "Export", reset: "Reset", discard: "Discard my edits?",
    foot: "{ceo} · CEO · Updated {date}", footLocal: "edits in this browser", footPublished: "published data",

    n_clip: ["clip", "clips"], n_product: ["product", "products"], n_idea: ["idea", "ideas"], n_channel: ["channel", "channels"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  },

  th: {
    upNext: "สิ่งที่ต้องทำต่อ", board: "บอร์ดงาน", departments: "แผนก", new: "สร้างใหม่",
    newIdea: "ไอเดียใหม่", newClip: "คลิปใหม่", newProduct: "สินค้าใหม่", newChannel: "ช่องใหม่",
    editDept: "แก้ไขแผนก", editChannel: "แก้ไขช่อง", editProduct: "แก้ไขสินค้า", editClip: "แก้ไขคลิป",
    menu: "เมนู", close: "ปิด", langLabel: "ภาษา",

    st_idea: "ไอเดีย", st_doing: "กำลังทำ", st_done: "ลงแล้ว",
    st_active: "ใช้งานอยู่", st_planned: "วางแผน", st_paused: "พัก", st_unconfirmed: "รอยืนยัน",

    nextContext: "Bell Studio",
    nextLede: "<strong>กำลังทำ {doing}</strong> และมี<strong>ไอเดียรอ {ideas}</strong> จาก {channels}",
    statInProgress: "กำลังทำ", statIdeas: "ไอเดีย", statPublished: "ลงแล้ว",
    secInProgress: "กำลังทำ", secIdeas: "ไอเดีย", secNeedsChannel: "แผนกที่ยังไม่มีช่อง", secRecent: "ลงล่าสุด",
    emptyInProgress: "ยังไม่มีงานที่กำลังทำ เริ่มทำไอเดียไหนก็เปลี่ยนสถานะได้เลย",
    emptyIdeas: "ยังไม่มีไอเดียรอ", addIdea: "เพิ่มไอเดีย",
    emptyNoChannels: "สร้างช่องก่อน แล้วค่อยใส่ไอเดียลงในช่อง",
    emptyPublished: "ยังไม่มีงานที่ลงแล้ว",
    needsChannelRow: "{head} ยังไม่มีช่อง", addChannel: "เพิ่มช่อง",

    boardLede: "ทุกคลิปและไอเดีย <strong>แยกตามสถานะ</strong>", all: "ทั้งหมด", nothingHere: "ว่าง",

    ledBy: "ดูแลโดย <strong>{head}</strong>", statChannels: "ช่อง", statProducts: "สินค้า", statClipsPublished: "คลิปที่ลงแล้ว",
    secChannels: "ช่อง", secTeam: "ทีม", secRules: "กฎ", secSkills: "สกิล",
    noChannelYet: "{head} ยังไม่มีช่อง", noRoles: "ยังไม่มีบทบาท", noRules: "ยังไม่มีกฎ", noSkills: "ยังไม่มีสกิล",

    secProducts: "สินค้า", secOtherClips: "คลิปอื่นในช่องนี้",
    clipsOf: "ลงแล้ว {a} จาก {b}", noClipsYet: "ยังไม่มีคลิป", noPhoto: "ยังไม่มีรูป",
    addPhoto: "ใส่ลิงก์รูปสินค้า", photoUnavailable: "โหลดรูปไม่ได้ — เช็คว่าแชร์ลิงก์แล้ว",
    emptyChannelIdeas: "ยังไม่มีไอเดีย",

    statClipsDone: "คลิปที่ลงแล้ว", statClipsTotal: "คลิปทั้งหมด", secClips: "คลิป", addClip: "เพิ่มคลิป",
    factStatus: "สถานะ", factChannel: "ช่อง", factUpdated: "อัปเดต", factNote: "โน้ต",

    f_title: "ชื่องาน", f_titlePh: "คลิปหรือไอเดียอะไร", f_channel: "ช่อง", f_product: "สินค้า", f_none: "ไม่มี",
    f_status: "สถานะ", f_note: "โน้ต", f_notePh: "ใช้ engine อะไร ยาวเท่าไร ลงที่ไหน…",
    f_name: "ชื่อ", f_productPh: "ชื่อสินค้า", f_channelPh: "ชื่อช่องหรือบัญชี",
    f_photo: "ลิงก์รูป", f_photoHint: "วางลิงก์แชร์จาก Google Drive (ตั้งเป็น “ทุกคนที่มีลิงก์”) หรือ URL รูปที่ขึ้นต้นด้วย https",
    f_preview: "ตัวอย่างรูปจะแสดงตรงนี้", f_cantLoad: "โหลดลิงก์นี้ไม่ได้ เช็คว่าแชร์เป็น “ทุกคนที่มีลิงก์” แล้ว",
    f_dept: "แผนก", f_platform: "แพลตฟอร์ม", f_platformPh: "เช่น YouTube, Shopee Video",
    f_shop: "ช่องขายของ", f_shopHint: "เปิดไว้สำหรับช่อง Affiliate หรือร้านค้า งานจะแยกตามสินค้า",
    f_head: "หัวหน้าแผนก", f_persona: "บุคลิก", f_mission: "งานหลัก",
    f_team: "ทีม", f_teamHint: "บรรทัดละบทบาท: บทบาท — ทำอะไร",
    f_rules: "กฎ", f_rulesHint: "บรรทัดละข้อ", f_skills: "สกิล", f_skillsHint: "บรรทัดละสกิล",
    editDeptTitle: "แก้ไขแผนก {name}",
    save: "บันทึก", cancel: "ยกเลิก", delete: "ลบ", deleteWith: "ลบพร้อม{what}", confirmDelete: "ยืนยันการลบ",
    errTitle: "ใส่ชื่องานก่อนนะ", errName: "ใส่ชื่อก่อนนะ", errHead: "ต้องมีหัวหน้าแผนก",

    toastClipAdded: "เพิ่มคลิปแล้ว", toastClipSaved: "บันทึกคลิปแล้ว", toastClipDeleted: "ลบคลิปแล้ว",
    toastProductAdded: "เพิ่มสินค้าแล้ว", toastProductSaved: "บันทึกสินค้าแล้ว", toastProductDeleted: "ลบสินค้าแล้ว",
    toastChannelAdded: "เพิ่มช่องแล้ว", toastChannelSaved: "บันทึกช่องแล้ว", toastChannelDeleted: "ลบช่องแล้ว",
    toastDeptSaved: "บันทึกแผนกแล้ว", toastStorage: "บันทึกไม่ได้ — เบราว์เซอร์นี้ปิดการเก็บข้อมูลไว้",
    toastExported: "Export แล้ว — ส่งไฟล์ให้ Bell ได้เลย", toastReset: "กลับไปใช้ข้อมูลที่เผยแพร่แล้ว",

    ribbon: "ตอนนี้การแก้ไขบันทึกในเบราว์เซอร์นี้เท่านั้น จนกว่าจะต่อระบบล็อกอิน",
    export: "Export", reset: "รีเซ็ต", discard: "ทิ้งการแก้ไขทั้งหมด?",
    foot: "{ceo} · CEO · อัปเดต {date}", footLocal: "แก้ไขในเบราว์เซอร์นี้", footPublished: "ข้อมูลที่เผยแพร่",

    n_clip: ["คลิป", "คลิป"], n_product: ["สินค้า", "สินค้า"], n_idea: ["เรื่อง", "เรื่อง"], n_channel: ["ช่อง", "ช่อง"],
    months: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
  }
};
