import { useState, useEffect, useRef } from "react";
import { createClient } from '@supabase/supabase-js';

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  'https://oagnvwmaqfvuytsbqjqm.supabase.co',
  'sb_publishable_PLaX_de1tIbPamWWoszrag_FzxPrD54'
);

async function dbGet(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) { console.error(table, error); return []; }
  return data || [];
}
async function dbUpsert(table, item) {
  const { error } = await supabase.from(table).upsert(item);
  if (error) console.error('upsert', table, error);
  return !error;
}
async function dbDelete(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) console.error('delete', table, error);
  return !error;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
  :root {
    --red:#C8102E; --red-light:#fef0f2; --navy:#0F1A2E; --navy2:#1a2d4a;
    --bg:#F5F6FA; --card:#fff; --border:#E4E7F0;
    --text:#1a1f36; --muted:#6b7280;
    --green:#10b981; --yellow:#f59e0b; --blue:#3b82f6; --purple:#8b5cf6;
    --orange:#f97316;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);}
  h1,h2,h3{font-family:'Playfair Display',serif;}
  .app{display:flex;min-height:100vh;}

  /* SIDEBAR */
  .sidebar{width:252px;min-height:100vh;background:var(--navy);display:flex;flex-direction:column;position:fixed;left:0;top:0;z-index:100;overflow-y:auto;}
  .sidebar-logo{padding:22px 18px 18px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;gap:11px;}
  .sidebar-logo h2{color:#fff;font-size:1.2rem;}
  .sidebar-logo span{color:rgba(255,255,255,0.4);font-size:0.7rem;display:block;font-family:'DM Sans',sans-serif;}
  .nav-section{padding:10px 10px 4px;font-size:0.68rem;font-weight:700;color:rgba(255,255,255,0.25);letter-spacing:0.08em;text-transform:uppercase;}
  .nav-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;cursor:pointer;color:rgba(255,255,255,0.6);font-size:0.85rem;font-weight:500;margin-bottom:1px;transition:all 0.15s;user-select:none;}
  .nav-item:hover{background:rgba(255,255,255,0.07);color:#fff;}
  .nav-item.active{background:var(--red);color:#fff;box-shadow:0 3px 10px rgba(200,16,46,0.35);}
  .nav-item .ico{font-size:1rem;width:20px;text-align:center;}
  .sidebar-user{padding:14px 10px;border-top:1px solid rgba(255,255,255,0.07);margin-top:auto;}
  .user-card{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;background:rgba(255,255,255,0.05);}
  .u-av{width:34px;height:34px;border-radius:50%;background:var(--red);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.82rem;flex-shrink:0;}
  .u-name{color:#fff;font-size:0.82rem;font-weight:600;}
  .u-role{color:rgba(255,255,255,0.4);font-size:0.68rem;}
  .logout-btn{margin-top:7px;width:100%;padding:7px;border-radius:7px;background:transparent;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.45);font-size:0.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
  .logout-btn:hover{background:rgba(200,16,46,0.15);border-color:var(--red);color:#fff;}

  /* MAIN */
  .main{margin-left:252px;flex:1;display:flex;flex-direction:column;min-height:100vh;}
  .topbar{height:60px;background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:50;}
  .topbar h2{font-size:1.15rem;color:var(--text);}
  .topbar-right{display:flex;align-items:center;gap:12px;}
  .content{padding:24px;flex:1;}
  .page-fade{animation:fadeIn 0.22s ease;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}

  /* CARDS & STATS */
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:20px;}
  .stat-card{background:var(--card);border-radius:13px;padding:18px 18px 18px 22px;border:1px solid var(--border);border-left:4px solid var(--accent,var(--red));}
  .stat-card .ico2{font-size:1.5rem;margin-bottom:7px;}
  .stat-card .val{font-size:1.7rem;font-weight:700;font-family:'Playfair Display',serif;}
  .stat-card .lbl{font-size:0.78rem;color:var(--muted);margin-top:1px;font-weight:500;}
  .card{background:var(--card);border-radius:13px;border:1px solid var(--border);overflow:hidden;}
  .card-hd{padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
  .card-hd h3{font-size:0.95rem;font-family:'DM Sans',sans-serif;font-weight:700;}

  /* TABLE */
  table{width:100%;border-collapse:collapse;}
  thead tr{background:var(--bg);}
  th{padding:10px 14px;text-align:left;font-size:0.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;}
  td{padding:12px 14px;font-size:0.85rem;border-top:1px solid var(--border);}
  tr:hover td{background:#fafbfc;}

  /* BADGES */
  .badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:0.73rem;font-weight:700;}
  .badge.green{background:#d1fae5;color:#065f46;}
  .badge.red{background:#fee2e2;color:#991b1b;}
  .badge.yellow{background:#fef3c7;color:#92400e;}
  .badge.blue{background:#dbeafe;color:#1e40af;}
  .badge.gray{background:#f3f4f6;color:#374151;}
  .badge.purple{background:#ede9fe;color:#5b21b6;}
  .badge.orange{background:#ffedd5;color:#9a3412;}

  /* BUTTONS */
  .btn-red{background:var(--red);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:0.83rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;box-shadow:0 2px 7px rgba(200,16,46,0.25);}
  .btn-red:hover{background:#a50d25;}
  .btn-ghost{background:transparent;color:var(--text);border:1px solid var(--border);padding:8px 16px;border-radius:8px;font-size:0.83rem;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
  .btn-ghost:hover{background:var(--bg);}
  .btn-green{background:var(--green);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:0.83rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
  .btn-sm{padding:4px 10px;font-size:0.76rem;border-radius:7px;}
  .btn-blue{background:var(--blue);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:0.83rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;}

  /* MODAL */
  .modal-ov{position:fixed;inset:0;background:rgba(15,26,46,0.55);backdrop-filter:blur(5px);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;}
  .modal{background:var(--card);border-radius:16px;padding:26px;width:100%;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,0.2);animation:fadeIn 0.18s ease;max-height:90vh;overflow-y:auto;}
  .modal h3{font-size:1.1rem;margin-bottom:18px;}

  /* FORM */
  .fg{margin-bottom:14px;}
  .fg label{display:block;font-size:0.79rem;font-weight:700;color:var(--muted);margin-bottom:5px;}
  .fg input,.fg select,.fg textarea{width:100%;padding:9px 13px;border:1px solid var(--border);border-radius:8px;font-size:0.86rem;font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);outline:none;transition:border 0.15s;}
  .fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--red);background:#fff;}
  .fg2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .ma{display:flex;gap:9px;justify-content:flex-end;margin-top:18px;}

  /* TABS */
  .tabs{display:flex;gap:5px;background:var(--bg);border-radius:11px;padding:4px;margin-bottom:18px;flex-wrap:wrap;}
  .tab{padding:7px 15px;border-radius:8px;cursor:pointer;font-size:0.82rem;font-weight:500;color:var(--muted);transition:all 0.15s;border:none;background:none;font-family:'DM Sans',sans-serif;}
  .tab.active{background:var(--card);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,0.1);}

  /* MISC */
  .progress-bar{background:#e5e7eb;border-radius:99px;height:7px;overflow:hidden;}
  .progress-fill{height:100%;border-radius:99px;transition:width 0.3s;}
  .empty{padding:36px;text-align:center;color:var(--muted);font-size:0.88rem;}
  .avatar{width:28px;height:28px;border-radius:50%;background:var(--red);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:0.72rem;font-weight:700;flex-shrink:0;}
  .flex{display:flex;} .items-center{align-items:center;} .gap2{gap:8px;} .gap3{gap:12px;}
  .chip{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:99px;font-size:0.73rem;font-weight:700;}
  .chip.present{background:#d1fae5;color:#065f46;}
  .chip.absent{background:#fee2e2;color:#991b1b;}
  .chip.late{background:#fef3c7;color:#92400e;}

  /* NOTIF */
  .notif-btn{position:relative;background:none;border:none;cursor:pointer;font-size:1.25rem;padding:6px;border-radius:8px;transition:background 0.15s;}
  .notif-btn:hover{background:var(--bg);}
  .notif-dot{position:absolute;top:4px;right:4px;width:7px;height:7px;background:var(--red);border-radius:50%;border:2px solid var(--card);}
  .notif-panel{position:absolute;top:calc(100% + 7px);right:0;width:310px;background:var(--card);border:1px solid var(--border);border-radius:13px;box-shadow:0 10px 40px rgba(0,0,0,0.13);z-index:200;overflow:hidden;animation:fadeIn 0.15s ease;}
  .notif-ph{padding:13px 15px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;}
  .notif-item{padding:11px 15px;border-bottom:1px solid var(--border);}
  .notif-item:last-child{border-bottom:none;}
  .notif-item.unread{background:#fef9fa;}
  .notif-text{font-size:0.81rem;color:var(--text);line-height:1.4;}
  .notif-time{font-size:0.73rem;color:var(--muted);margin-top:2px;}

  /* PIPELINE */
  .pipeline{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;}
  .pipeline-col{min-width:220px;background:var(--bg);border-radius:12px;padding:12px;}
  .pipeline-col-hd{font-size:0.82rem;font-weight:700;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;}
  .lead-card{background:var(--card);border-radius:10px;padding:13px;margin-bottom:8px;border:1px solid var(--border);cursor:pointer;transition:box-shadow 0.15s;}
  .lead-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.08);}
  .lead-name{font-size:0.86rem;font-weight:600;margin-bottom:3px;}
  .lead-info{font-size:0.77rem;color:var(--muted);}

  /* TELEGRAM MODAL */
  .tg-setup{background:linear-gradient(135deg,#229ED9,#1a7db0);border-radius:13px;padding:20px;color:#fff;margin-bottom:16px;}
  .tg-setup h4{font-size:0.95rem;margin-bottom:6px;font-family:'DM Sans',sans-serif;font-weight:700;}
  .tg-setup p{font-size:0.82rem;opacity:0.85;line-height:1.5;}
  .tg-token-input{width:100%;padding:9px 13px;border-radius:8px;border:none;font-size:0.85rem;font-family:'DM Sans',sans-serif;margin-top:10px;}

  /* GRADE */
  .grade-circle{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;font-family:'Playfair Display',serif;}

  /* BAR CHART */
  .bar-chart{display:flex;align-items:flex-end;gap:7px;height:110px;padding:0 2px;}
  .bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;}
  .bar{width:100%;background:var(--red);border-radius:5px 5px 0 0;transition:height 0.3s;opacity:0.85;}
  .bar:hover{opacity:1;}
  .bar-lbl{font-size:0.67rem;color:var(--muted);}
  .bar-val{font-size:0.67rem;font-weight:700;color:var(--muted);}

  /* SEARCH */
  .search-input{padding:8px 13px;border:1px solid var(--border);border-radius:8px;width:240px;font-size:0.84rem;font-family:'DM Sans',sans-serif;background:var(--card);outline:none;}
  .search-input:focus{border-color:var(--red);}

  input[type=date]{color-scheme:light;}
  @media(max-width:768px){.sidebar{width:200px;}.main{margin-left:200px;}.stat-grid{grid-template-columns:1fr 1fr;}.content{padding:14px;}}
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const ini = n => n?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
const fmt = n => Number(n).toLocaleString("uz-UZ") + " so'm";
const today = new Date().toISOString().split("T")[0];
const now = () => new Date().toLocaleTimeString("uz-UZ",{hour:"2-digit",minute:"2-digit"});
const uid = () => Math.random().toString(36).slice(2,9);

const ROLE_LABELS = {superadmin:"Super Admin",branch_dir:"Filial direktori",manager:"Menejer",admin:"Admin",reception:"Resepshn",teacher:"O'qituvchi",finance:"Kassa",student:"Talaba",parent:"Ota-ona"};
const ROLE_COLORS = {superadmin:"purple",branch_dir:"orange",manager:"blue",admin:"blue",reception:"green",teacher:"yellow",finance:"blue",student:"gray",parent:"green"};

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const USERS0 = [
  {id:"u1",name:"Alibek Yusupov",email:"superadmin@lola.uz",password:"1234",role:"superadmin",phone:"+998901110001",branchId:"b1"},
  {id:"u2",name:"Dilorom Nazarova",email:"admin@lola.uz",password:"1234",role:"admin",phone:"+998901110002",branchId:"b1"},
  {id:"u3",name:"Shahlo Mirzaeva",email:"reception@lola.uz",password:"1234",role:"reception",phone:"+998901110003",branchId:"b1"},
  {id:"u4",name:"Jasur Nazarov",email:"jasur@lola.uz",password:"1234",role:"teacher",phone:"+998901110004",branchId:"b1"},
  {id:"u5",name:"Malika Karimova",email:"malika@lola.uz",password:"1234",role:"teacher",phone:"+998901110005",branchId:"b1"},
  {id:"u6",name:"Bekzod Toshmatov",email:"bekzod@lola.uz",password:"1234",role:"finance",phone:"+998901110006",branchId:"b1"},
  {id:"u7",name:"Murod Ismoilov",email:"manager@lola.uz",password:"1234",role:"manager",phone:"+998901110007",branchId:"b1"},
  {id:"u8",name:"Zulfiya Raximova",email:"zulfiya@lola.uz",password:"1234",role:"student",phone:"+998901110008",branchId:"b1",groupId:"g1",parentId:"u11"},
  {id:"u9",name:"Otabek Xoliqov",email:"otabek@lola.uz",password:"1234",role:"student",phone:"+998901110009",branchId:"b1",groupId:"g2",parentId:"u12"},
  {id:"u10",name:"Nodira Saidova",email:"nodira@lola.uz",password:"1234",role:"student",phone:"+998901110010",branchId:"b1",groupId:"g1"},
  {id:"u11",name:"Hamida Raximova",email:"hamida@lola.uz",password:"1234",role:"parent",phone:"+998901110011",branchId:"b1",childId:"u8"},
  {id:"u12",name:"Sanjar Xoliqov",email:"sanjar@lola.uz",password:"1234",role:"parent",phone:"+998901110012",branchId:"b1",childId:"u9"},
  {id:"u13",name:"Dilshod Ergashev",email:"dir@lola.uz",password:"1234",role:"branch_dir",phone:"+998901110013",branchId:"b2"},
  {id:"u14",name:"Barno Usmonova",email:"barno@lola.uz",password:"1234",role:"student",phone:"+998901110014",branchId:"b2",groupId:"g3"},
];
const BRANCHES0 = [
  {id:"b1",name:"Lola Edu Chilonzor",address:"Toshkent, Chilonzor, 14-kv",phone:"+998712223344",directorId:"u2"},
  {id:"b2",name:"Lola Edu Sergeli",address:"Toshkent, Sergeli, 5-kv",phone:"+998712223355",directorId:"u13"},
];
const COURSES0 = [
  {id:"c1",name:"Ingliz tili (IELTS)",duration:"4 oy",price:500000,description:"IELTS 6.0+ tayyorlov"},
  {id:"c2",name:"Matematika",duration:"3 oy",price:400000,description:"Olimpiada matematikasi"},
  {id:"c3",name:"Rus tili",duration:"3 oy",price:350000,description:"A1-B1 darajasi"},
];
const GROUPS0 = [
  {id:"g1",name:"IELTS-A1",teacherId:"u4",courseId:"c1",schedule:"Du,Cho,Ju 09:00",room:"201",students:["u8","u10"],startDate:"2024-01-10",endDate:"2024-05-10",status:"active",branchId:"b1"},
  {id:"g2",name:"Matematik-B2",teacherId:"u4",courseId:"c2",schedule:"Se,Pa,Sh 11:00",room:"102",students:["u9"],startDate:"2024-02-01",endDate:"2024-05-01",status:"active",branchId:"b1"},
  {id:"g3",name:"Rus tili-C1",teacherId:"u5",courseId:"c3",schedule:"Du,Cho 14:00",room:"301",students:["u14"],startDate:"2024-03-01",endDate:"2024-06-01",status:"active",branchId:"b2"},
];
const ATTENDANCE0 = [
  {id:"a1",groupId:"g1",studentId:"u8",date:today,status:"absent"},
  {id:"a2",groupId:"g1",studentId:"u10",date:today,status:"present"},
  {id:"a3",groupId:"g2",studentId:"u9",date:today,status:"late"},
  {id:"a4",groupId:"g1",studentId:"u8",date:"2024-03-20",status:"present"},
  {id:"a5",groupId:"g1",studentId:"u10",date:"2024-03-20",status:"present"},
];
const PAYMENTS0 = [
  {id:"p1",studentId:"u8",groupId:"g1",amount:500000,date:"2024-04-01",method:"naqd",status:"unpaid",month:"2024-05"},
  {id:"p2",studentId:"u9",groupId:"g2",amount:400000,date:"2024-04-01",method:"click",status:"paid",month:"2024-05"},
  {id:"p3",studentId:"u10",groupId:"g1",amount:500000,date:"2024-04-01",method:"payme",status:"paid",month:"2024-05"},
  {id:"p4",studentId:"u14",groupId:"g3",amount:350000,date:"2024-04-01",method:"naqd",status:"unpaid",month:"2024-05"},
];
const EXPENSES0 = [
  {id:"e1",category:"Ijara",amount:3000000,date:"2024-05-01",desc:"Ofis ijarasi",branchId:"b1"},
  {id:"e2",category:"Kommunal",amount:400000,date:"2024-05-05",desc:"Elektr, suv",branchId:"b1"},
  {id:"e3",category:"Maosh",amount:2500000,date:"2024-05-10",desc:"O'qituvchilar maoshi",branchId:"b1"},
];
const LEADS0 = [
  {id:"l1",name:"Aziza Xasanova",phone:"+998901230001",source:"Instagram",course:"Ingliz tili",stage:"new",note:"IELTS uchun qiziqadi",date:"2024-05-01",assignedTo:"u7",branchId:"b1"},
  {id:"l2",name:"Temur Yusupov",phone:"+998901230002",source:"Telegram",course:"Matematika",stage:"called",note:"Sinov darsiga keladi",date:"2024-05-02",assignedTo:"u7",branchId:"b1"},
  {id:"l3",name:"Gulnora Mirzaeva",phone:"+998901230003",source:"Referral",course:"Rus tili",stage:"trial",note:"Sinov darsida qatnashdi",date:"2024-05-03",assignedTo:"u3",branchId:"b1"},
  {id:"l4",name:"Sherzod Karimov",phone:"+998901230004",source:"Website",course:"Ingliz tili",stage:"contract",note:"Shartnoma imzolandi",date:"2024-05-04",assignedTo:"u7",branchId:"b1"},
  {id:"l5",name:"Mohira Tosheva",phone:"+998901230005",source:"Instagram",course:"Matematika",stage:"new",note:"",date:"2024-05-05",assignedTo:"u3",branchId:"b2"},
];
const GRADES0 = [
  {id:"gr1",studentId:"u8",groupId:"g1",type:"homework",title:"Unit 4 vazifasi",score:85,maxScore:100,date:"2024-04-20",teacherNote:"Yaxshi ishlagan"},
  {id:"gr2",studentId:"u10",groupId:"g1",type:"quiz",title:"Grammar Quiz",score:72,maxScore:100,date:"2024-04-22",teacherNote:""},
  {id:"gr3",studentId:"u9",groupId:"g2",type:"midterm",title:"Yarim yillik",score:91,maxScore:100,date:"2024-04-25",teacherNote:"A'lo natija"},
];
const NOTIFICATIONS0 = [
  {id:"n1",text:"Zulfiya Raximova bugun darsga kelmadi (IELTS-A1)",time:"09:15",type:"warning",read:false,forRoles:["admin","reception","superadmin","manager"]},
  {id:"n2",text:"Yangi lead: Aziza Xasanova (Instagram)",time:"10:00",type:"info",read:false,forRoles:["admin","manager","reception","superadmin"]},
  {id:"n3",text:"Otabek to'lovi tasdiqlandi",time:"11:30",type:"info",read:true,forRoles:["admin","finance","superadmin"]},
];
const SMSLOG0 = [
  {id:"s1",to:"+998901110008",text:"Zulfiya, bugun darsga kelmadingiz.",date:today,channel:"sms",type:"absent",status:"sent"},
];
const SALARIES0 = [
  {id:"sal1",teacherId:"u4",month:"2024-05",baseAmount:1500000,bonusAmount:300000,deduction:0,status:"unpaid",pct:30,branchId:"b1"},
  {id:"sal2",teacherId:"u5",month:"2024-05",baseAmount:1200000,bonusAmount:0,deduction:50000,status:"paid",pct:28,branchId:"b1"},
];
const TGCONFIG0 = {token:"",chatId:"",connected:false};

// ─── NAV CONFIG ───────────────────────────────────────────────────────────────
const NAV = {
  superadmin:[
    {section:"Asosiy"},{key:"dashboard",ico:"📊",label:"Dashboard"},{key:"branches",ico:"🏢",label:"Filiallar"},
    {section:"O'quv"},{key:"students",ico:"👩‍🎓",label:"Talabalar"},{key:"groups",ico:"📚",label:"Guruhlar"},{key:"courses",ico:"🎓",label:"Kurslar"},
    {section:"Boshqaruv"},{key:"leads",ico:"🎯",label:"CRM — Leadlar"},{key:"attendance",ico:"✅",label:"Davomat"},{key:"grades",ico:"📝",label:"Baholar"},
    {section:"Moliya"},{key:"payments",ico:"💳",label:"To'lovlar"},{key:"expenses",ico:"💸",label:"Xarajatlar"},{key:"salary",ico:"💼",label:"Maosh"},{key:"reports",ico:"📈",label:"Hisobotlar"},
    {section:"Sozlama"},{key:"users",ico:"👥",label:"Foydalanuvchilar"},{key:"telegram",ico:"✈️",label:"Telegram/SMS"},{key:"settings",ico:"⚙️",label:"Sozlamalar"},
  ],
  admin:[
    {section:"Asosiy"},{key:"dashboard",ico:"📊",label:"Dashboard"},
    {section:"O'quv"},{key:"students",ico:"👩‍🎓",label:"Talabalar"},{key:"teachers",ico:"👨‍🏫",label:"O'qituvchilar"},{key:"groups",ico:"📚",label:"Guruhlar"},{key:"courses",ico:"🎓",label:"Kurslar"},
    {section:"Boshqaruv"},{key:"leads",ico:"🎯",label:"CRM — Leadlar"},{key:"attendance",ico:"✅",label:"Davomat"},{key:"grades",ico:"📝",label:"Baholar"},
    {section:"Moliya"},{key:"payments",ico:"💳",label:"To'lovlar"},{key:"expenses",ico:"💸",label:"Xarajatlar"},{key:"salary",ico:"💼",label:"Maosh"},{key:"reports",ico:"📈",label:"Hisobotlar"},
    {section:"Sozlama"},{key:"users",ico:"👥",label:"Foydalanuvchilar"},{key:"telegram",ico:"✈️",label:"Telegram/SMS"},{key:"settings",ico:"⚙️",label:"Sozlamalar"},
  ],
  branch_dir:[
    {section:"Asosiy"},{key:"dashboard",ico:"📊",label:"Dashboard"},
    {section:"O'quv"},{key:"students",ico:"👩‍🎓",label:"Talabalar"},{key:"teachers",ico:"👨‍🏫",label:"O'qituvchilar"},{key:"groups",ico:"📚",label:"Guruhlar"},
    {section:"Boshqaruv"},{key:"leads",ico:"🎯",label:"CRM — Leadlar"},{key:"attendance",ico:"✅",label:"Davomat"},
    {section:"Moliya"},{key:"payments",ico:"💳",label:"To'lovlar"},{key:"reports",ico:"📈",label:"Hisobotlar"},
  ],
  manager:[
    {section:"Asosiy"},{key:"dashboard",ico:"📊",label:"Dashboard"},
    {section:"Boshqaruv"},{key:"leads",ico:"🎯",label:"CRM — Leadlar"},{key:"students",ico:"👩‍🎓",label:"Talabalar"},
    {section:"Aloqa"},{key:"sms",ico:"💬",label:"SMS/Telegram"},
  ],
  reception:[
    {section:"Asosiy"},{key:"dashboard",ico:"📊",label:"Dashboard"},
    {section:"O'quv"},{key:"students",ico:"👩‍🎓",label:"Talabalar"},{key:"attendance",ico:"✅",label:"Davomat ko'rish"},
    {section:"Aloqa"},{key:"sms",ico:"💬",label:"SMS/Telegram"},{key:"leads",ico:"🎯",label:"Leadlar"},
  ],
  teacher:[
    {section:"Asosiy"},{key:"dashboard",ico:"📊",label:"Dashboard"},
    {section:"O'quv"},{key:"my_groups",ico:"📚",label:"Guruhlarim"},{key:"attendance_mark",ico:"✅",label:"Davomat belgilash"},{key:"grades",ico:"📝",label:"Baholar"},
  ],
  finance:[
    {section:"Asosiy"},{key:"dashboard",ico:"📊",label:"Dashboard"},
    {section:"Moliya"},{key:"payments",ico:"💳",label:"To'lovlar"},{key:"expenses",ico:"💸",label:"Xarajatlar"},{key:"salary",ico:"💼",label:"Maosh"},{key:"reports",ico:"📈",label:"Hisobotlar"},
  ],
  student:[
    {section:"Asosiy"},{key:"dashboard",ico:"📊",label:"Dashboard"},
    {section:"O'quv"},{key:"my_schedule",ico:"📅",label:"Jadvalim"},{key:"my_attendance",ico:"✅",label:"Davomatim"},{key:"my_grades",ico:"📝",label:"Baholarim"},
    {section:"Moliya"},{key:"my_payments",ico:"💳",label:"To'lovlarim"},
  ],
  parent:[
    {section:"Farzandim"},{key:"dashboard",ico:"📊",label:"Dashboard"},{key:"child_attendance",ico:"✅",label:"Davomat"},{key:"child_grades",ico:"📝",label:"Baholar"},{key:"child_payments",ico:"💳",label:"To'lovlar"},
  ],
};

const PAGE_TITLES = {
  dashboard:"Dashboard",branches:"Filiallar",students:"Talabalar",teachers:"O'qituvchilar",
  groups:"Guruhlar",courses:"Kurslar",leads:"CRM — Leadlar",attendance:"Davomat",
  attendance_mark:"Davomat belgilash",grades:"Baholar",payments:"To'lovlar",
  expenses:"Xarajatlar",salary:"Maosh tizimi",reports:"Hisobotlar",users:"Foydalanuvchilar",
  telegram:"Telegram / SMS",settings:"Sozlamalar",sms:"SMS/Telegram",
  my_groups:"Guruhlarim",my_schedule:"Jadvalim",my_attendance:"Davomatim",
  my_grades:"Baholarim",my_payments:"To'lovlarim",child_attendance:"Davomat",
  child_grades:"Baholar",child_payments:"To'lovlar",
};

// ─── NOTIFICATION BELL ────────────────────────────────────────────────────────
function NotifBell({notifications,setNotifications,role}) {
  const [open,setOpen]=useState(false);
  const ref=useRef();
  const mine=notifications.filter(n=>n.forRoles.includes(role));
  const unread=mine.filter(n=>!n.read).length;
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  return(
    <div style={{position:"relative"}} ref={ref}>
      <button className="notif-btn" onClick={()=>setOpen(o=>!o)}>
        🔔{unread>0&&<span className="notif-dot"/>}
      </button>
      {open&&(
        <div className="notif-panel">
          <div className="notif-ph">
            <span style={{fontWeight:700,fontSize:"0.88rem"}}>Bildirishnomalar {unread>0&&<span className="badge red" style={{marginLeft:4}}>{unread}</span>}</span>
            <button onClick={()=>setNotifications(p=>p.map(n=>({...n,read:true})))} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.76rem",color:"var(--red)"}}>Barchasini o'qi</button>
          </div>
          {mine.length===0?<div className="empty">Bildirishnoma yo'q</div>:
            mine.slice(0,8).map(n=>(
              <div key={n.id} className={"notif-item"+(n.read?"":" unread")}>
                <div className="notif-text">{n.type==="warning"?"⚠️":n.type==="att"?"✅":"ℹ️"} {n.text}</div>
                <div className="notif-time">{n.time}</div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({onLogin}) {
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const demos=[
    {l:"Super Admin",e:"superadmin@lola.uz"},{l:"Admin",e:"admin@lola.uz"},
    {l:"Menejer",e:"manager@lola.uz"},{l:"Resepshn",e:"reception@lola.uz"},
    {l:"O'qituvchi",e:"jasur@lola.uz"},{l:"Kassa",e:"bekzod@lola.uz"},
    {l:"Talaba",e:"zulfiya@lola.uz"},{l:"Ota-ona",e:"hamida@lola.uz"},
    {l:"Filial Direktor",e:"dir@lola.uz"},
  ];
  const login=()=>{
    const u=USERS0.find(u=>u.email===email&&u.password===pass);
    if(u)onLogin(u); else setErr("Email yoki parol noto'g'ri");
  };
  return(
    <div style={{minHeight:"100vh",background:"var(--navy)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{width:"100%",maxWidth:"440px"}}>
        <div style={{textAlign:"center",marginBottom:"28px"}}>
          <div style={{fontSize:"3rem",marginBottom:"6px"}}>🌸</div>
          <h1 style={{color:"#fff",fontSize:"2rem"}}>Lola Edu</h1>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:"0.88rem",marginTop:"3px"}}>Boshqaruv tizimiga kirish</p>
        </div>
        <div style={{background:"var(--card)",borderRadius:"16px",padding:"26px"}}>
          <div className="fg"><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="email@lola.uz"/></div>
          <div className="fg"><label>Parol</label><input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="••••" onKeyDown={e=>e.key==="Enter"&&login()}/></div>
          {err&&<p style={{color:"var(--red)",fontSize:"0.81rem",marginBottom:"10px"}}>{err}</p>}
          <button className="btn-red" style={{width:"100%",padding:"11px"}} onClick={login}>Kirish</button>
          <div style={{marginTop:"18px",borderTop:"1px solid var(--border)",paddingTop:"14px"}}>
            <p style={{fontSize:"0.75rem",color:"var(--muted)",marginBottom:"9px",fontWeight:700}}>Demo (parol: 1234)</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
              {demos.map(d=>(
                <button key={d.e} onClick={()=>{setEmail(d.e);setPass("1234");setErr("");}}
                  style={{padding:"4px 9px",borderRadius:"7px",border:"1px solid var(--border)",background:"var(--bg)",fontSize:"0.73rem",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",color:"var(--text)"}}>
                  {d.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARDS ───────────────────────────────────────────────────────────────
function SuperAdminDash({users,groups,payments,expenses,leads,branches}) {
  const students=users.filter(u=>u.role==="student");
  const income=payments.filter(p=>p.status==="paid").reduce((s,p)=>s+p.amount,0);
  const exp=expenses.reduce((s,e)=>s+e.amount,0);
  const newLeads=leads.filter(l=>l.stage==="new").length;
  const months=["Jan","Feb","Mar","Apr","May","Jun"];
  const mi=months.map((_,i)=>Math.round(Math.random()*4000000+1500000));
  const mx=Math.max(...mi);
  return(
    <div className="page-fade">
      <div className="stat-grid">
        {[
          {ico:"🏢",val:branches.length,lbl:"Filiallar",ac:"#8b5cf6"},
          {ico:"👩‍🎓",val:students.length,lbl:"Jami talabalar",ac:"#3b82f6"},
          {ico:"📚",val:groups.length,lbl:"Guruhlar",ac:"#f59e0b"},
          {ico:"💰",val:fmt(income),lbl:"Jami daromad",ac:"#10b981"},
          {ico:"💸",val:fmt(exp),lbl:"Xarajatlar",ac:"#ef4444"},
          {ico:"🎯",val:newLeads,lbl:"Yangi leadlar",ac:"#C8102E"},
        ].map((s,i)=>(
          <div key={i} className="stat-card" style={{"--accent":s.ac}}>
            <div className="ico2">{s.ico}</div>
            <div className="val" style={{fontSize:typeof s.val==="string"?"1.1rem":"1.7rem"}}>{s.val}</div>
            <div className="lbl">{s.lbl}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"14px"}}>
        <div className="card">
          <div className="card-hd"><h3>📈 Oylik daromad</h3></div>
          <div style={{padding:"18px"}}>
            <div className="bar-chart">
              {mi.map((v,i)=>(
                <div key={i} className="bar-col">
                  <div className="bar-val">{(v/1000000).toFixed(1)}M</div>
                  <div className="bar" style={{height:`${(v/mx)*90}px`}}/>
                  <div className="bar-lbl">{months[i]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-hd"><h3>🏢 Filiallar</h3></div>
          <div className="card-body">
            {branches.map(b=>{
              const bStudents=users.filter(u=>u.role==="student"&&u.branchId===b.id).length;
              const bIncome=payments.filter(p=>p.status==="paid"&&users.find(u=>u.id===p.studentId)?.branchId===b.id).reduce((s,p)=>s+p.amount,0);
              return(
                <div key={b.id} style={{padding:"13px 16px",borderBottom:"1px solid var(--border)"}}>
                  <div style={{fontWeight:600,fontSize:"0.87rem",marginBottom:"4px"}}>{b.name}</div>
                  <div style={{display:"flex",gap:"8px"}}>
                    <span className="badge blue">{bStudents} talaba</span>
                    <span className="badge green">{fmt(bIncome)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ManagerDash({leads,users}) {
  const stages=["new","called","trial","contract","student"];
  const stageCnt=stages.reduce((acc,s)=>({...acc,[s]:leads.filter(l=>l.stage===s).length}),{});
  const conv=leads.length?Math.round((leads.filter(l=>l.stage==="student").length/leads.length)*100):0;
  return(
    <div className="page-fade">
      <div className="stat-grid">
        {[
          {ico:"🎯",val:leads.length,lbl:"Jami leadlar",ac:"#C8102E"},
          {ico:"📞",val:stageCnt.called||0,lbl:"Qo'ng'iroq qilindi",ac:"#3b82f6"},
          {ico:"🧪",val:stageCnt.trial||0,lbl:"Sinov darsida",ac:"#f59e0b"},
          {ico:"✅",val:conv+"%",lbl:"Konversiya",ac:"#10b981"},
        ].map((s,i)=>(
          <div key={i} className="stat-card" style={{"--accent":s.ac}}>
            <div className="ico2">{s.ico}</div>
            <div className="val">{s.val}</div>
            <div className="lbl">{s.lbl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeacherDash({cu,groups,users,attendance}) {
  const mg=groups.filter(g=>g.teacherId===cu.id);
  const msi=[...new Set(mg.flatMap(g=>g.students))];
  const ta=attendance.filter(a=>a.date===today&&msi.includes(a.studentId));
  return(
    <div className="page-fade">
      <div className="stat-grid">
        <div className="stat-card" style={{"--accent":"#3b82f6"}}><div className="ico2">📚</div><div className="val">{mg.length}</div><div className="lbl">Guruhlarim</div></div>
        <div className="stat-card" style={{"--accent":"#10b981"}}><div className="ico2">👩‍🎓</div><div className="val">{msi.length}</div><div className="lbl">Talabalar</div></div>
        <div className="stat-card" style={{"--accent":"#C8102E"}}><div className="ico2">✅</div><div className="val">{ta.filter(a=>a.status==="present").length}/{ta.length}</div><div className="lbl">Bugungi davomat</div></div>
      </div>
    </div>
  );
}

function ParentDash({cu,users,groups,attendance,payments,grades}) {
  const child=users.find(u=>u.id===cu.childId);
  const group=groups.find(g=>g.id===child?.groupId);
  const att=attendance.filter(a=>a.studentId===child?.id);
  const pct=att.length?Math.round((att.filter(a=>a.status==="present").length/att.length)*100):0;
  const unp=payments.filter(p=>p.studentId===child?.id&&p.status==="unpaid");
  const gr=grades.filter(g=>g.studentId===child?.id);
  const avg=gr.length?Math.round(gr.reduce((s,g)=>s+(g.score/g.maxScore)*100,0)/gr.length):0;
  return(
    <div className="page-fade">
      {child&&<div style={{background:"linear-gradient(135deg,var(--red),#a50d25)",borderRadius:"13px",padding:"20px",color:"#fff",marginBottom:"18px",display:"flex",alignItems:"center",gap:"16px"}}>
        <div style={{width:"52px",height:"52px",borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",fontWeight:700}}>{ini(child.name)}</div>
        <div>
          <div style={{fontSize:"1.2rem",fontWeight:700,fontFamily:"'Playfair Display',serif"}}>{child.name}</div>
          <div style={{fontSize:"0.82rem",opacity:0.8}}>{group?.name||"Guruh yo'q"} • {group?.schedule||""}</div>
        </div>
      </div>}
      <div className="stat-grid">
        <div className="stat-card" style={{"--accent":pct>=70?"#10b981":"#C8102E"}}><div className="ico2">✅</div><div className="val">{pct}%</div><div className="lbl">Davomat</div></div>
        <div className="stat-card" style={{"--accent":"#3b82f6"}}><div className="ico2">📝</div><div className="val">{avg}%</div><div className="lbl">O'rtacha baho</div></div>
        <div className="stat-card" style={{"--accent":unp.length?"#ef4444":"#10b981"}}><div className="ico2">{unp.length?"⚠️":"✅"}</div><div className="val">{unp.length?fmt(unp.reduce((s,p)=>s+p.amount,0)):"To'liq"}</div><div className="lbl">To'lov</div></div>
      </div>
    </div>
  );
}

function StudentDash({cu,groups,payments,attendance,courses}) {
  const group=groups.find(g=>g.id===cu.groupId);
  const course=courses.find(c=>c.id===group?.courseId);
  const att=attendance.filter(a=>a.studentId===cu.id);
  const pct=att.length?Math.round((att.filter(a=>a.status==="present").length/att.length)*100):0;
  const unp=payments.filter(p=>p.studentId===cu.id&&p.status==="unpaid");
  return(
    <div className="page-fade">
      <div className="stat-grid">
        <div className="stat-card" style={{"--accent":"#3b82f6"}}><div className="ico2">📚</div><div className="val" style={{fontSize:"1rem"}}>{group?.name||"—"}</div><div className="lbl">Guruhim</div></div>
        <div className="stat-card" style={{"--accent":pct>=70?"#10b981":"#C8102E"}}><div className="ico2">✅</div><div className="val">{pct}%</div><div className="lbl">Davomat</div></div>
        <div className="stat-card" style={{"--accent":unp.length?"#ef4444":"#10b981"}}><div className="ico2">{unp.length?"⚠️":"✅"}</div><div className="val" style={{fontSize:unp.length?"0.95rem":"1.7rem"}}>{unp.length?fmt(unp.reduce((s,p)=>s+p.amount,0)):"To'liq"}</div><div className="lbl">To'lov holati</div></div>
      </div>
      {group&&<div className="card" style={{padding:"18px"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
        {[["Guruh",group.name],["Kurs",course?.name||"—"],["Jadval",group.schedule],["Xona",group.room+" - xona"],["Narx",fmt(course?.price||0)],["Tugash",group.endDate]].map(([k,v])=>(
          <div key={k} style={{background:"var(--bg)",padding:"11px",borderRadius:"9px"}}>
            <div style={{fontSize:"0.73rem",color:"var(--muted)",fontWeight:700,marginBottom:"2px"}}>{k}</div>
            <div style={{fontSize:"0.87rem",fontWeight:500}}>{v}</div>
          </div>
        ))}
      </div></div>}
    </div>
  );
}

// ─── CRM LEADS ────────────────────────────────────────────────────────────────
const STAGES=[
  {key:"new",label:"Yangi",color:"#3b82f6"},
  {key:"called",label:"Qo'ng'iroq",color:"#f59e0b"},
  {key:"trial",label:"Sinov darsi",color:"#8b5cf6"},
  {key:"contract",label:"Shartnoma",color:"#10b981"},
  {key:"student",label:"Talaba",color:"#C8102E"},
];
const SOURCES=["Instagram","Telegram","Referral","Website","Boshqa"];

function LeadsPage({leads,setLeads,users,courses,setUsers,groups,setGroups,cu}) {
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({name:"",phone:"",source:"Instagram",course:"",stage:"new",note:"",assignedTo:"",date:today,branchId:cu.branchId||"b1"});
  const [detailLead,setDetailLead]=useState(null);

  const open=l=>{setForm(l||{name:"",phone:"",source:"Instagram",course:"",stage:"new",note:"",assignedTo:"",date:today,branchId:cu.branchId||"b1"});setModal(l||"new");};
  const save=()=>{
    if(modal==="new") setLeads(p=>[...p,{...form,id:"l"+uid()}]);
    else setLeads(p=>p.map(l=>l.id===modal.id?{...l,...form}:l));
    setModal(null);
  };
  const del=id=>{if(confirm("O'chirishni tasdiqlaysizmi?"))setLeads(p=>p.filter(l=>l.id!==id));};
  const moveStage=(id,stage)=>setLeads(p=>p.map(l=>l.id===id?{...l,stage}:l));
  const convertToStudent=(lead)=>{
    const newStudent={id:"u"+uid(),name:lead.name,email:lead.phone+"@lola.uz",password:"1234",role:"student",phone:lead.phone,branchId:lead.branchId};
    setUsers(p=>[...p,newStudent]);
    setLeads(p=>p.map(l=>l.id===lead.id?{...l,stage:"student"}:l));
    alert(`✅ ${lead.name} talaba sifatida qo'shildi!\nEmail: ${lead.phone}@lola.uz\nParol: 1234`);
    setDetailLead(null);
  };

  const visibleLeads = ["superadmin","admin"].includes(cu.role) ? leads : leads.filter(l=>l.branchId===cu.branchId);

  return(
    <div className="page-fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
        <div className="flex gap2">
          {STAGES.map(s=>(
            <div key={s.key} style={{background:"var(--card)",border:`2px solid ${s.color}`,borderRadius:"9px",padding:"6px 12px",fontSize:"0.78rem",fontWeight:700,color:s.color}}>
              {s.label}: {visibleLeads.filter(l=>l.stage===s.key).length}
            </div>
          ))}
        </div>
        <button className="btn-red" onClick={()=>open(null)}>+ Lead qo'shish</button>
      </div>
      <div className="pipeline">
        {STAGES.map(s=>(
          <div key={s.key} className="pipeline-col">
            <div className="pipeline-col-hd">
              <span style={{color:s.color}}>{s.label}</span>
              <span className="badge" style={{background:s.color+"20",color:s.color}}>{visibleLeads.filter(l=>l.stage===s.key).length}</span>
            </div>
            {visibleLeads.filter(l=>l.stage===s.key).map(l=>(
              <div key={l.id} className="lead-card" onClick={()=>setDetailLead(l)}>
                <div className="lead-name">{l.name}</div>
                <div className="lead-info">📱 {l.phone}</div>
                <div className="lead-info">📚 {l.course}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"8px"}}>
                  <span className="badge blue">{l.source}</span>
                  <span style={{fontSize:"0.72rem",color:"var(--muted)"}}>{l.date}</span>
                </div>
              </div>
            ))}
            {visibleLeads.filter(l=>l.stage===s.key).length===0&&<div style={{textAlign:"center",padding:"20px",color:"var(--muted)",fontSize:"0.8rem"}}>Bo'sh</div>}
          </div>
        ))}
      </div>

      {/* Lead detail modal */}
      {detailLead&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setDetailLead(null)}>
          <div className="modal">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"16px"}}>
              <h3 style={{marginBottom:0}}>{detailLead.name}</h3>
              <button className="btn-ghost btn-sm" onClick={()=>setDetailLead(null)}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"16px"}}>
              {[["📱 Telefon",detailLead.phone],["📌 Manba",detailLead.source],["📚 Kurs",detailLead.course],["📅 Sana",detailLead.date]].map(([k,v])=>(
                <div key={k} style={{background:"var(--bg)",padding:"10px",borderRadius:"9px"}}>
                  <div style={{fontSize:"0.73rem",color:"var(--muted)",fontWeight:700,marginBottom:"2px"}}>{k}</div>
                  <div style={{fontSize:"0.86rem",fontWeight:500}}>{v}</div>
                </div>
              ))}
            </div>
            {detailLead.note&&<div style={{background:"var(--bg)",padding:"12px",borderRadius:"9px",marginBottom:"14px"}}>
              <div style={{fontSize:"0.73rem",color:"var(--muted)",fontWeight:700,marginBottom:"3px"}}>📝 Izoh</div>
              <div style={{fontSize:"0.85rem"}}>{detailLead.note}</div>
            </div>}
            <div style={{marginBottom:"14px"}}>
              <div style={{fontSize:"0.79rem",color:"var(--muted)",fontWeight:700,marginBottom:"7px"}}>Bosqichni o'zgartirish:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                {STAGES.map(s=>(
                  <button key={s.key}
                    onClick={()=>{moveStage(detailLead.id,s.key);setDetailLead(p=>({...p,stage:s.key}));}}
                    style={{padding:"5px 11px",borderRadius:"8px",border:`2px solid ${s.color}`,background:detailLead.stage===s.key?s.color:"transparent",color:detailLead.stage===s.key?"#fff":s.color,fontSize:"0.78rem",fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              <button className="btn-ghost btn-sm" onClick={()=>{setDetailLead(null);open(detailLead);}}>✏️ Tahrirlash</button>
              <button className="btn-green btn-sm" onClick={()=>convertToStudent(detailLead)}>🎓 Talabaga o'tkazish</button>
              <button className="btn-red btn-sm" onClick={()=>{del(detailLead.id);setDetailLead(null);}}>🗑️ O'chirish</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {modal&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <h3>{modal==="new"?"Yangi lead":"Leadni tahrirlash"}</h3>
            <div className="fg2">
              <div className="fg"><label>Ism-familiya</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
              <div className="fg"><label>Telefon</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/></div>
            </div>
            <div className="fg2">
              <div className="fg"><label>Manba</label><select value={form.source} onChange={e=>setForm(p=>({...p,source:e.target.value}))}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select></div>
              <div className="fg"><label>Kurs</label><select value={form.course} onChange={e=>setForm(p=>({...p,course:e.target.value}))}><option value="">Tanlang</option>{courses.map(c=><option key={c.id}>{c.name}</option>)}</select></div>
            </div>
            <div className="fg2">
              <div className="fg"><label>Bosqich</label><select value={form.stage} onChange={e=>setForm(p=>({...p,stage:e.target.value}))}>{STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
              <div className="fg"><label>Mas'ul</label><select value={form.assignedTo} onChange={e=>setForm(p=>({...p,assignedTo:e.target.value}))}><option value="">Tanlang</option>{users.filter(u=>["manager","reception","admin"].includes(u.role)).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            </div>
            <div className="fg"><label>Izoh</label><textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} rows={2}/></div>
            <div className="ma"><button className="btn-ghost" onClick={()=>setModal(null)}>Bekor</button><button className="btn-red" onClick={save}>Saqlash</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GRADES ───────────────────────────────────────────────────────────────────
const GRADE_TYPES=[{k:"homework",l:"Uyga vazifa"},{k:"quiz",l:"Quiz"},{k:"midterm",l:"Oraliq"},{k:"final",l:"Final"}];

function GradesPage({grades,setGrades,users,groups,cu}) {
  const [tab,setTab]=useState("homework");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({studentId:"",groupId:"",type:"homework",title:"",score:"",maxScore:"100",date:today,teacherNote:""});

  const canEdit=["admin","teacher","superadmin"].includes(cu.role);
  const visGroups = cu.role==="teacher"?groups.filter(g=>g.teacherId===cu.id):groups;
  const visGrades = cu.role==="teacher"
    ? grades.filter(g=>visGroups.map(gr=>gr.id).includes(g.groupId))
    : grades;
  const filtered=visGrades.filter(g=>g.type===tab);

  const save=()=>{
    if(modal==="new") setGrades(p=>[...p,{...form,id:"gr"+uid(),score:Number(form.score),maxScore:Number(form.maxScore)}]);
    else setGrades(p=>p.map(g=>g.id===modal.id?{...g,...form,score:Number(form.score),maxScore:Number(form.maxScore)}:g));
    setModal(null);
  };
  const del=id=>{if(confirm("O'chirishni tasdiqlaysizmi?"))setGrades(p=>p.filter(g=>g.id!==id));};
  const open=g=>{setForm(g||{studentId:"",groupId:"",type:tab,title:"",score:"",maxScore:"100",date:today,teacherNote:""});setModal(g||"new");};

  const scoreColor=pct=>pct>=80?"#10b981":pct>=60?"#f59e0b":"#ef4444";

  return(
    <div className="page-fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
        <div/>
        {canEdit&&<button className="btn-red" onClick={()=>open(null)}>+ Baho qo'shish</button>}
      </div>
      <div className="tabs">
        {GRADE_TYPES.map(t=><button key={t.k} className={`tab ${tab===t.k?"active":""}`} onClick={()=>setTab(t.k)}>{t.l}</button>)}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Talaba</th><th>Guruh</th><th>Sarlavha</th><th>Ball</th><th>Foiz</th><th>Sana</th><th>Izoh</th>{canEdit&&<th>Amal</th>}</tr></thead>
          <tbody>
            {filtered.map(g=>{
              const st=users.find(u=>u.id===g.studentId);
              const gr=groups.find(gr=>gr.id===g.groupId);
              const pct=Math.round((g.score/g.maxScore)*100);
              return(
                <tr key={g.id}>
                  <td><div className="flex items-center gap2"><div className="avatar">{ini(st?.name)}</div><span style={{fontWeight:500}}>{st?.name||"—"}</span></div></td>
                  <td style={{fontSize:"0.82rem"}}>{gr?.name||"—"}</td>
                  <td style={{fontWeight:500}}>{g.title}</td>
                  <td><strong>{g.score}</strong>/{g.maxScore}</td>
                  <td>
                    <div className="grade-circle" style={{background:scoreColor(pct)+"20",color:scoreColor(pct)}}>{pct}%</div>
                  </td>
                  <td style={{fontSize:"0.81rem",color:"var(--muted)"}}>{g.date}</td>
                  <td style={{fontSize:"0.81rem",color:"var(--muted)",maxWidth:"150px"}}>{g.teacherNote||"—"}</td>
                  {canEdit&&<td>
                    <div className="flex gap2">
                      <button className="btn-ghost btn-sm" onClick={()=>open(g)}>✏️</button>
                      <button className="btn-red btn-sm" onClick={()=>del(g.id)}>🗑️</button>
                    </div>
                  </td>}
                </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={8}><div className="empty">Baholar yo'q</div></td></tr>}
          </tbody>
        </table>
      </div>
      {modal&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <h3>{modal==="new"?"Yangi baho":"Bahoni tahrirlash"}</h3>
            <div className="fg2">
              <div className="fg"><label>Guruh</label><select value={form.groupId} onChange={e=>{const g=groups.find(gr=>gr.id===e.target.value);setForm(p=>({...p,groupId:e.target.value,studentId:g?.students[0]||""}));}}>
                <option value="">Tanlang</option>{visGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
              <div className="fg"><label>Talaba</label><select value={form.studentId} onChange={e=>setForm(p=>({...p,studentId:e.target.value}))}>
                <option value="">Tanlang</option>{(groups.find(g=>g.id===form.groupId)?.students||[]).map(sid=>{const u=users.find(u=>u.id===sid);return u?<option key={sid} value={sid}>{u.name}</option>:null;})}
              </select></div>
            </div>
            <div className="fg"><label>Tur</label><select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>{GRADE_TYPES.map(t=><option key={t.k} value={t.k}>{t.l}</option>)}</select></div>
            <div className="fg"><label>Sarlavha</label><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/></div>
            <div className="fg2">
              <div className="fg"><label>Ball</label><input type="number" value={form.score} onChange={e=>setForm(p=>({...p,score:e.target.value}))}/></div>
              <div className="fg"><label>Maksimal ball</label><input type="number" value={form.maxScore} onChange={e=>setForm(p=>({...p,maxScore:e.target.value}))}/></div>
            </div>
            <div className="fg2">
              <div className="fg"><label>Sana</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
              <div className="fg"><label>Izoh</label><input value={form.teacherNote} onChange={e=>setForm(p=>({...p,teacherNote:e.target.value}))}/></div>
            </div>
            <div className="ma"><button className="btn-ghost" onClick={()=>setModal(null)}>Bekor</button><button className="btn-red" onClick={save}>Saqlash</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STUDENTS PAGE ────────────────────────────────────────────────────────────
function StudentsPage({users,setUsers,groups,payments,courses,cu}) {
  const [search,setSearch]=useState("");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({name:"",email:"",phone:"",groupId:"",password:"1234",branchId:cu.branchId||"b1"});
  const students=users.filter(u=>u.role==="student"&&(["superadmin","admin"].includes(cu.role)||u.branchId===cu.branchId));
  const filtered=students.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())||s.phone?.includes(search));
  const canEdit=["admin","superadmin","branch_dir"].includes(cu.role);
  const canAdd=["admin","superadmin","reception","branch_dir"].includes(cu.role);
  const open=s=>{setForm(s||{name:"",email:"",phone:"",groupId:"",password:"1234",branchId:cu.branchId||"b1"});setModal(s||"new");};
  const save=()=>{
    if(modal==="new") setUsers(p=>[...p,{...form,id:"u"+uid(),role:"student"}]);
    else setUsers(p=>p.map(u=>u.id===modal.id?{...u,...form}:u));
    setModal(null);
  };
  const del=id=>{if(confirm("O'chirish tasdiqlaysizmi?"))setUsers(p=>p.filter(u=>u.id!==id));};
  return(
    <div className="page-fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
        <input className="search-input" placeholder="🔍 Qidirish..." value={search} onChange={e=>setSearch(e.target.value)}/>
        {canAdd&&<button className="btn-red" onClick={()=>open(null)}>+ Talaba qo'shish</button>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Talaba</th><th>Telefon</th><th>Guruh</th><th>To'lov</th>{(canEdit)&&<th>Amal</th>}</tr></thead>
          <tbody>
            {filtered.map(s=>{
              const group=groups.find(g=>g.id===s.groupId);
              const unp=payments.find(p=>p.studentId===s.id&&p.status==="unpaid");
              return(
                <tr key={s.id}>
                  <td><div className="flex items-center gap2"><div className="avatar">{ini(s.name)}</div><span style={{fontWeight:500}}>{s.name}</span></div></td>
                  <td style={{color:"var(--muted)",fontSize:"0.83rem"}}>{s.phone}</td>
                  <td>{group?<span className="badge blue">{group.name}</span>:<span className="badge gray">—</span>}</td>
                  <td><span className={`badge ${unp?"red":"green"}`}>{unp?"Qarzdor":"To'lagan"}</span></td>
                  {canEdit&&<td><div className="flex gap2"><button className="btn-ghost btn-sm" onClick={()=>open(s)}>✏️</button>{["admin","superadmin"].includes(cu.role)&&<button className="btn-red btn-sm" onClick={()=>del(s.id)}>🗑️</button>}</div></td>}
                </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={5}><div className="empty">Talabalar topilmadi</div></td></tr>}
          </tbody>
        </table>
      </div>
      {modal&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <h3>{modal==="new"?"Yangi talaba":"Tahrirlash"}</h3>
            {[["name","Ism-familiya"],["email","Email"],["phone","Telefon"],["password","Parol"]].map(([f,l])=>(
              <div key={f} className="fg"><label>{l}</label><input value={form[f]||""} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))}/></div>
            ))}
            <div className="fg"><label>Guruh</label><select value={form.groupId||""} onChange={e=>setForm(p=>({...p,groupId:e.target.value}))}><option value="">Tanlang</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
            <div className="ma"><button className="btn-ghost" onClick={()=>setModal(null)}>Bekor</button><button className="btn-red" onClick={save}>Saqlash</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TEACHERS PAGE ────────────────────────────────────────────────────────────
function TeachersPage({users,setUsers,groups,cu}) {
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({name:"",email:"",phone:"",password:"1234",branchId:cu.branchId||"b1"});
  const teachers=users.filter(u=>u.role==="teacher"&&(["superadmin","admin"].includes(cu.role)||u.branchId===cu.branchId));
  const open=t=>{setForm(t||{name:"",email:"",phone:"",password:"1234",branchId:cu.branchId||"b1"});setModal(t||"new");};
  const save=()=>{
    if(modal==="new") setUsers(p=>[...p,{...form,id:"u"+uid(),role:"teacher"}]);
    else setUsers(p=>p.map(u=>u.id===modal.id?{...u,...form}:u));
    setModal(null);
  };
  return(
    <div className="page-fade">
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"16px"}}>
        <button className="btn-red" onClick={()=>open(null)}>+ O'qituvchi qo'shish</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>O'qituvchi</th><th>Telefon</th><th>Guruhlar</th><th>Amal</th></tr></thead>
          <tbody>
            {teachers.map(t=>{
              const mg=groups.filter(g=>g.teacherId===t.id);
              return(
                <tr key={t.id}>
                  <td><div className="flex items-center gap2"><div className="avatar">{ini(t.name)}</div><span style={{fontWeight:500}}>{t.name}</span></div></td>
                  <td style={{color:"var(--muted)",fontSize:"0.83rem"}}>{t.phone}</td>
                  <td><span className="badge blue">{mg.length} ta</span></td>
                  <td><button className="btn-ghost btn-sm" onClick={()=>open(t)}>✏️</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {modal&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <h3>{modal==="new"?"Yangi o'qituvchi":"Tahrirlash"}</h3>
            {[["name","Ism"],["email","Email"],["phone","Telefon"]].map(([f,l])=>(
              <div key={f} className="fg"><label>{l}</label><input value={form[f]||""} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))}/></div>
            ))}
            <div className="ma"><button className="btn-ghost" onClick={()=>setModal(null)}>Bekor</button><button className="btn-red" onClick={save}>Saqlash</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GROUPS PAGE ──────────────────────────────────────────────────────────────
function GroupsPage({groups,setGroups,users,courses,cu}) {
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({name:"",teacherId:"",courseId:"",schedule:"",room:"",startDate:"",endDate:"",status:"active",branchId:cu.branchId||"b1"});
  const vis=["superadmin","admin"].includes(cu.role)?groups:groups.filter(g=>g.branchId===cu.branchId);
  const open=g=>{setForm(g||{name:"",teacherId:"",courseId:"",schedule:"",room:"",startDate:"",endDate:"",status:"active",branchId:cu.branchId||"b1"});setModal(g||"new");};
  const save=()=>{
    if(modal==="new") setGroups(p=>[...p,{...form,id:"g"+uid(),students:[]}]);
    else setGroups(p=>p.map(g=>g.id===modal.id?{...g,...form}:g));
    setModal(null);
  };
  const del=id=>{if(confirm("O'chirishni tasdiqlaysizmi?"))setGroups(p=>p.filter(g=>g.id!==id));};
  return(
    <div className="page-fade">
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"16px"}}>
        <button className="btn-red" onClick={()=>open(null)}>+ Guruh qo'shish</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Guruh</th><th>O'qituvchi</th><th>Kurs</th><th>Talabalar</th><th>Jadval</th><th>Holat</th><th>Amal</th></tr></thead>
          <tbody>
            {vis.map(g=>{
              const t=users.find(u=>u.id===g.teacherId);
              const c=courses.find(c=>c.id===g.courseId);
              return(
                <tr key={g.id}>
                  <td><strong>{g.name}</strong></td>
                  <td style={{fontSize:"0.83rem"}}>{t?.name||"—"}</td>
                  <td style={{fontSize:"0.82rem"}}>{c?.name||"—"}</td>
                  <td><span className="badge blue">{g.students.length} ta</span></td>
                  <td style={{fontSize:"0.8rem",color:"var(--muted)"}}>{g.schedule}</td>
                  <td><span className={`badge ${g.status==="active"?"green":"gray"}`}>{g.status==="active"?"Faol":"Rejalashtirilgan"}</span></td>
                  <td><div className="flex gap2"><button className="btn-ghost btn-sm" onClick={()=>open(g)}>✏️</button><button className="btn-red btn-sm" onClick={()=>del(g.id)}>🗑️</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {modal&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <h3>{modal==="new"?"Yangi guruh":"Guruhni tahrirlash"}</h3>
            <div className="fg"><label>Guruh nomi</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
            <div className="fg2">
              <div className="fg"><label>O'qituvchi</label><select value={form.teacherId} onChange={e=>setForm(p=>({...p,teacherId:e.target.value}))}><option value="">Tanlang</option>{users.filter(u=>u.role==="teacher").map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="fg"><label>Kurs</label><select value={form.courseId} onChange={e=>setForm(p=>({...p,courseId:e.target.value}))}><option value="">Tanlang</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>
            <div className="fg2">
              <div className="fg"><label>Jadval</label><input value={form.schedule} onChange={e=>setForm(p=>({...p,schedule:e.target.value}))}/></div>
              <div className="fg"><label>Xona</label><input value={form.room} onChange={e=>setForm(p=>({...p,room:e.target.value}))}/></div>
            </div>
            <div className="fg2">
              <div className="fg"><label>Boshlanish</label><input type="date" value={form.startDate} onChange={e=>setForm(p=>({...p,startDate:e.target.value}))}/></div>
              <div className="fg"><label>Tugash</label><input type="date" value={form.endDate} onChange={e=>setForm(p=>({...p,endDate:e.target.value}))}/></div>
            </div>
            <div className="ma"><button className="btn-ghost" onClick={()=>setModal(null)}>Bekor</button><button className="btn-red" onClick={save}>Saqlash</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────
function AttendancePage({attendance,groups,users,cu}) {
  const [selGroup,setSelGroup]=useState(groups[0]?.id||"");
  const [selDate,setSelDate]=useState(today);
  const vis=["superadmin","admin"].includes(cu.role)?groups:groups.filter(g=>g.branchId===cu.branchId);
  const group=vis.find(g=>g.id===selGroup)||vis[0];
  const records=attendance.filter(a=>a.groupId===group?.id&&a.date===selDate);
  const students=(group?.students||[]).map(id=>users.find(u=>u.id===id)).filter(Boolean);
  return(
    <div className="page-fade">
      <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}}>
        <select value={selGroup} onChange={e=>setSelGroup(e.target.value)} style={{padding:"8px 13px",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"0.84rem",fontFamily:"'DM Sans',sans-serif",background:"var(--card)"}}>
          {vis.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{padding:"8px 13px",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"0.84rem",fontFamily:"'DM Sans',sans-serif",background:"var(--card)"}}/>
      </div>
      <div className="card">
        <div className="card-hd"><h3>✅ Davomat — {group?.name} | {selDate}</h3>
          <div className="flex gap2">
            <span className="badge green">✅ {records.filter(r=>r.status==="present").length}</span>
            <span className="badge red">❌ {records.filter(r=>r.status==="absent").length}</span>
            <span className="badge yellow">🕐 {records.filter(r=>r.status==="late").length}</span>
          </div>
        </div>
        <table>
          <thead><tr><th>Talaba</th><th>Holat</th></tr></thead>
          <tbody>
            {students.map(s=>{
              const rec=records.find(r=>r.studentId===s.id);
              return(
                <tr key={s.id}>
                  <td><div className="flex items-center gap2"><div className="avatar">{ini(s.name)}</div>{s.name}</div></td>
                  <td>{rec?<span className={`chip ${rec.status}`}>{rec.status==="present"?"✅ Keldi":rec.status==="absent"?"❌ Kelmadi":"🕐 Kech keldi"}</span>:<span className="badge gray">Belgilanmagan</span>}</td>
                </tr>
              );
            })}
            {students.length===0&&<tr><td colSpan={2}><div className="empty">Talabalar yo'q</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttendanceMarkPage({cu,attendance,setAttendance,groups,users,setNotifications}) {
  const mg=groups.filter(g=>g.teacherId===cu.id);
  const [sg,setSg]=useState(mg[0]?.id||"");
  const [sd,setSd]=useState(today);
  const [marks,setMarks]=useState({});
  const group=groups.find(g=>g.id===sg);
  const students=(group?.students||[]).map(id=>users.find(u=>u.id===id)).filter(Boolean);
  useEffect(()=>{
    const ex={};
    attendance.filter(a=>a.groupId===sg&&a.date===sd).forEach(a=>{ex[a.studentId]=a.status;});
    setMarks(ex);
  },[sg,sd]);
  const save=()=>{
    const recs=students.map(s=>({id:"a"+uid(),groupId:sg,studentId:s.id,date:sd,status:marks[s.id]||"present"}));
    setAttendance(p=>[...p.filter(a=>!(a.groupId===sg&&a.date===sd)),...recs]);
    const bad=students.filter(s=>["absent","late"].includes(marks[s.id]||"present"));
    if(bad.length){
      setNotifications(p=>[{id:"n"+uid(),forRoles:["admin","reception","superadmin","manager"],
        text:`${cu.name} davomat belgiladi. ${bad.map(s=>s.name).join(", ")} ${bad.length>1?"kelmadi/kech keldi":"kelmadi"}`,
        time:now(),type:"att",read:false},...p]);
    }
    alert("✅ Davomat saqlandi!");
  };
  return(
    <div className="page-fade">
      <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}}>
        <select value={sg} onChange={e=>setSg(e.target.value)} style={{padding:"8px 13px",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"0.84rem",fontFamily:"'DM Sans',sans-serif",background:"var(--card)"}}>
          {mg.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input type="date" value={sd} onChange={e=>setSd(e.target.value)} style={{padding:"8px 13px",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"0.84rem",fontFamily:"'DM Sans',sans-serif",background:"var(--card)"}}/>
      </div>
      <div className="card">
        <div className="card-hd"><h3>✅ {group?.name} — Davomat belgilash</h3></div>
        <table>
          <thead><tr><th>Talaba</th><th>Holat</th></tr></thead>
          <tbody>
            {students.map(s=>(
              <tr key={s.id}>
                <td><div className="flex items-center gap2"><div className="avatar">{ini(s.name)}</div>{s.name}</div></td>
                <td>
                  <div className="flex gap2">
                    {[["present","✅ Keldi","#10b981"],["absent","❌ Kelmadi","#ef4444"],["late","🕐 Kech","#f59e0b"]].map(([v,l,c])=>(
                      <button key={v} onClick={()=>setMarks(m=>({...m,[s.id]:v}))}
                        style={{padding:"5px 11px",borderRadius:"7px",border:`2px solid ${(marks[s.id]||"present")===v?c:"var(--border)"}`,background:(marks[s.id]||"present")===v?c+"20":"transparent",color:(marks[s.id]||"present")===v?c:"var(--muted)",fontSize:"0.77rem",fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}>
                        {l}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {students.length===0&&<tr><td colSpan={2}><div className="empty">Talabalar yo'q</div></td></tr>}
          </tbody>
        </table>
        {students.length>0&&<div style={{padding:"14px 16px",borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end"}}><button className="btn-red" onClick={save}>💾 Saqlash</button></div>}
      </div>
    </div>
  );
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
const PAY_METHODS=["naqd","click","payme","uzum","bank"];

function PaymentsPage({payments,setPayments,users,groups,cu}) {
  const [tab,setTab]=useState("all");
  const vis=["superadmin","admin"].includes(cu.role)?payments:payments.filter(p=>{const u=users.find(u=>u.id===p.studentId);return u?.branchId===cu.branchId;});
  const filtered=tab==="all"?vis:vis.filter(p=>p.status===tab);
  const markPaid=(id,method)=>setPayments(p=>p.map(x=>x.id===id?{...x,status:"paid",date:today,method}:x));
  return(
    <div className="page-fade">
      <div className="tabs">
        {[["all","Barchasi"],["unpaid","Qarzdorlar"],["paid","To'langanlar"]].map(([v,l])=>(
          <button key={v} className={`tab ${tab===v?"active":""}`} onClick={()=>setTab(v)}>{l}</button>
        ))}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Talaba</th><th>Guruh</th><th>Oy</th><th>Summa</th><th>Usul</th><th>Holat</th><th>Amal</th></tr></thead>
          <tbody>
            {filtered.map(p=>{
              const st=users.find(u=>u.id===p.studentId);
              const gr=groups.find(g=>g.id===p.groupId);
              return(
                <tr key={p.id}>
                  <td><div className="flex items-center gap2"><div className="avatar">{ini(st?.name)}</div><span style={{fontWeight:500}}>{st?.name}</span></div></td>
                  <td style={{fontSize:"0.83rem"}}>{gr?.name||"—"}</td>
                  <td style={{fontSize:"0.82rem",color:"var(--muted)"}}>{p.month}</td>
                  <td style={{fontWeight:700}}>{fmt(p.amount)}</td>
                  <td>
                    {p.status==="unpaid"?(
                      <select style={{padding:"4px 8px",borderRadius:"7px",border:"1px solid var(--border)",fontSize:"0.78rem",fontFamily:"'DM Sans',sans-serif",background:"var(--bg)"}}
                        onChange={e=>e.target.value&&markPaid(p.id,e.target.value)} defaultValue="">
                        <option value="">To'lov usuli...</option>
                        {PAY_METHODS.map(m=><option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                      </select>
                    ):<span className="badge blue">{p.method}</span>}
                  </td>
                  <td><span className={`badge ${p.status==="paid"?"green":"red"}`}>{p.status==="paid"?"✅ To'langan":"❌ Qarzdor"}</span></td>
                  <td>{p.status==="unpaid"&&<button className="btn-red btn-sm" onClick={()=>markPaid(p.id,"naqd")}>✅ Naqd</button>}</td>
                </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={7}><div className="empty">Ma'lumot yo'q</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
function ExpensesPage({expenses,setExpenses,cu}) {
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({category:"Ijara",amount:"",date:today,desc:"",branchId:cu.branchId||"b1"});
  const cats=["Ijara","Kommunal","Jihozlar","Maosh","Marketing","Kommunal","Boshqa"];
  const vis=["superadmin","admin"].includes(cu.role)?expenses:expenses.filter(e=>e.branchId===cu.branchId);
  const total=vis.reduce((s,e)=>s+e.amount,0);
  const save=()=>{setExpenses(p=>[...p,{...form,id:"e"+uid(),amount:Number(form.amount)}]);setForm({category:"Ijara",amount:"",date:today,desc:"",branchId:cu.branchId||"b1"});setModal(false);};
  const del=id=>{if(confirm("O'chirishni tasdiqlaysizmi?"))setExpenses(p=>p.filter(e=>e.id!==id));};
  return(
    <div className="page-fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
        <div style={{background:"var(--card)",padding:"11px 18px",borderRadius:"11px",border:"1px solid var(--border)"}}>
          <span style={{color:"var(--muted)",fontSize:"0.8rem"}}>Jami: </span>
          <span style={{fontWeight:700,color:"var(--red)"}}>{fmt(total)}</span>
        </div>
        <button className="btn-red" onClick={()=>setModal(true)}>+ Xarajat qo'shish</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Kategoriya</th><th>Tavsif</th><th>Summa</th><th>Sana</th><th>Amal</th></tr></thead>
          <tbody>
            {vis.map(e=>(
              <tr key={e.id}>
                <td><span className="badge blue">{e.category}</span></td>
                <td style={{fontSize:"0.85rem"}}>{e.desc}</td>
                <td style={{fontWeight:700,color:"var(--red)"}}>{fmt(e.amount)}</td>
                <td style={{fontSize:"0.81rem",color:"var(--muted)"}}>{e.date}</td>
                <td><button className="btn-red btn-sm" onClick={()=>del(e.id)}>🗑️</button></td>
              </tr>
            ))}
            {vis.length===0&&<tr><td colSpan={5}><div className="empty">Xarajatlar yo'q</div></td></tr>}
          </tbody>
        </table>
      </div>
      {modal&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h3>Yangi xarajat</h3>
            <div className="fg"><label>Kategoriya</label><select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>{cats.map(c=><option key={c}>{c}</option>)}</select></div>
            <div className="fg"><label>Summa (so'm)</label><input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))}/></div>
            <div className="fg"><label>Sana</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
            <div className="fg"><label>Tavsif</label><input value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))}/></div>
            <div className="ma"><button className="btn-ghost" onClick={()=>setModal(false)}>Bekor</button><button className="btn-red" onClick={save}>Saqlash</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SALARY ───────────────────────────────────────────────────────────────────
function SalaryPage({salaries,setSalaries,users,groups,payments,cu}) {
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({teacherId:"",month:today.slice(0,7),baseAmount:"",bonusAmount:"0",deduction:"0",pct:30,status:"unpaid",branchId:cu.branchId||"b1"});
  const teachers=users.filter(u=>u.role==="teacher"&&(["superadmin","admin"].includes(cu.role)||u.branchId===cu.branchId));
  const vis=["superadmin","admin"].includes(cu.role)?salaries:salaries.filter(s=>s.branchId===cu.branchId);

  const calcSalary=(teacherId,month,pct)=>{
    const tGroups=groups.filter(g=>g.teacherId===teacherId);
    const income=payments.filter(p=>tGroups.some(g=>g.id===p.groupId)&&p.status==="paid"&&p.month===month).reduce((s,p)=>s+p.amount,0);
    return Math.round(income*(pct/100));
  };
  const open=s=>{setForm(s||{teacherId:"",month:today.slice(0,7),baseAmount:"",bonusAmount:"0",deduction:"0",pct:30,status:"unpaid",branchId:cu.branchId||"b1"});setModal(s||"new");};
  const save=()=>{
    const base=Number(form.baseAmount)||calcSalary(form.teacherId,form.month,form.pct);
    if(modal==="new") setSalaries(p=>[...p,{...form,id:"sal"+uid(),baseAmount:base,bonusAmount:Number(form.bonusAmount),deduction:Number(form.deduction)}]);
    else setSalaries(p=>p.map(s=>s.id===modal.id?{...s,...form,baseAmount:base,bonusAmount:Number(form.bonusAmount),deduction:Number(form.deduction)}:s));
    setModal(null);
  };
  const markPaid=id=>setSalaries(p=>p.map(s=>s.id===id?{...s,status:"paid"}:s));

  return(
    <div className="page-fade">
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"16px"}}>
        <button className="btn-red" onClick={()=>open(null)}>+ Maosh hisoblash</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>O'qituvchi</th><th>Oy</th><th>Asosiy</th><th>Bonus</th><th>Jarima</th><th>Jami</th><th>Holat</th><th>Amal</th></tr></thead>
          <tbody>
            {vis.map(s=>{
              const t=users.find(u=>u.id===s.teacherId);
              const total=s.baseAmount+s.bonusAmount-s.deduction;
              return(
                <tr key={s.id}>
                  <td><div className="flex items-center gap2"><div className="avatar">{ini(t?.name)}</div><span style={{fontWeight:500}}>{t?.name||"—"}</span></div></td>
                  <td style={{color:"var(--muted)",fontSize:"0.83rem"}}>{s.month}</td>
                  <td>{fmt(s.baseAmount)}</td>
                  <td style={{color:"var(--green)"}}>{s.bonusAmount>0?"+"+fmt(s.bonusAmount):"—"}</td>
                  <td style={{color:"var(--red)"}}>{s.deduction>0?"-"+fmt(s.deduction):"—"}</td>
                  <td style={{fontWeight:700}}>{fmt(total)}</td>
                  <td><span className={`badge ${s.status==="paid"?"green":"yellow"}`}>{s.status==="paid"?"✅ To'langan":"⏳ Kutilmoqda"}</span></td>
                  <td>
                    <div className="flex gap2">
                      <button className="btn-ghost btn-sm" onClick={()=>open(s)}>✏️</button>
                      {s.status==="unpaid"&&<button className="btn-green btn-sm" onClick={()=>markPaid(s.id)}>💸 To'la</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {vis.length===0&&<tr><td colSpan={8}><div className="empty">Maosh hisoblari yo'q</div></td></tr>}
          </tbody>
        </table>
      </div>
      {modal&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <h3>{modal==="new"?"Maosh hisoblash":"Tahrirlash"}</h3>
            <div className="fg"><label>O'qituvchi</label><select value={form.teacherId} onChange={e=>setForm(p=>({...p,teacherId:e.target.value}))}><option value="">Tanlang</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div className="fg2">
              <div className="fg"><label>Oy</label><input type="month" value={form.month} onChange={e=>setForm(p=>({...p,month:e.target.value}))}/></div>
              <div className="fg"><label>Foiz (%)</label><input type="number" value={form.pct} onChange={e=>setForm(p=>({...p,pct:Number(e.target.value)}))}/></div>
            </div>
            <div className="fg"><label>Asosiy maosh (avtomatik hisob yoki qo'lda)</label><input type="number" value={form.baseAmount} onChange={e=>setForm(p=>({...p,baseAmount:e.target.value}))} placeholder="Bo'sh qolsa avtomatik hisoblanadi"/></div>
            <div className="fg2">
              <div className="fg"><label>Bonus</label><input type="number" value={form.bonusAmount} onChange={e=>setForm(p=>({...p,bonusAmount:e.target.value}))}/></div>
              <div className="fg"><label>Jarima</label><input type="number" value={form.deduction} onChange={e=>setForm(p=>({...p,deduction:e.target.value}))}/></div>
            </div>
            <div className="ma"><button className="btn-ghost" onClick={()=>setModal(null)}>Bekor</button><button className="btn-red" onClick={save}>Saqlash</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
function ReportsPage({payments,expenses,groups,users,leads}) {
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mi=months.map((_,i)=>{const m=`2024-${String(i+1).padStart(2,"0")}`;return payments.filter(p=>p.status==="paid"&&p.month?.startsWith(m)).reduce((s,p)=>s+p.amount,0);});
  const ei=months.map((_,i)=>{const m=`2024-${String(i+1).padStart(2,"0")}`;return expenses.filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+e.amount,0);});
  const mx=Math.max(...mi,...ei,1);
  const expByCat={};expenses.forEach(e=>{expByCat[e.category]=(expByCat[e.category]||0)+e.amount;});
  const leadBySrc={};leads.forEach(l=>{leadBySrc[l.source]=(leadBySrc[l.source]||0)+1;});
  const conv=leads.length?Math.round((leads.filter(l=>l.stage==="student").length/leads.length)*100):0;
  return(
    <div className="page-fade">
      <div className="card" style={{marginBottom:"14px"}}>
        <div className="card-hd"><h3>📈 Oylik daromad vs xarajat</h3></div>
        <div style={{padding:"18px"}}>
          <div style={{display:"flex",gap:"14px",marginBottom:"10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.78rem"}}><div style={{width:"13px",height:"13px",background:"var(--green)",borderRadius:"3px"}}/> Daromad</div>
            <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"0.78rem"}}><div style={{width:"13px",height:"13px",background:"var(--red)",borderRadius:"3px",opacity:0.6}}/> Xarajat</div>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:"5px",height:"130px"}}>
            {months.map((_,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"2px"}}>
                <div style={{width:"100%",display:"flex",gap:"2px",alignItems:"flex-end",height:"100px"}}>
                  <div style={{flex:1,background:"var(--green)",borderRadius:"4px 4px 0 0",height:`${(mi[i]/mx)*95}px`,opacity:0.85}}/>
                  <div style={{flex:1,background:"var(--red)",borderRadius:"4px 4px 0 0",height:`${(ei[i]/mx)*95}px`,opacity:0.5}}/>
                </div>
                <div style={{fontSize:"0.65rem",color:"var(--muted)"}}>{months[i]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"14px"}}>
        <div className="card">
          <div className="card-hd"><h3>💸 Xarajat tarkibi</h3></div>
          <div style={{padding:"14px"}}>
            {Object.entries(expByCat).map(([cat,amt])=>(
              <div key={cat} style={{marginBottom:"10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.83rem",marginBottom:"3px"}}><span>{cat}</span><span style={{fontWeight:700}}>{fmt(amt)}</span></div>
                <div className="progress-bar"><div className="progress-fill" style={{width:`${(amt/expenses.reduce((s,e)=>s+e.amount,1))*100}%`,background:"var(--red)"}}/></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-hd"><h3>🎯 Lead manbalar</h3></div>
          <div style={{padding:"14px"}}>
            {Object.entries(leadBySrc).map(([src,cnt])=>(
              <div key={src} style={{marginBottom:"10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.83rem",marginBottom:"3px"}}><span>{src}</span><span className="badge blue">{cnt} ta</span></div>
                <div className="progress-bar"><div className="progress-fill" style={{width:`${(cnt/leads.length)*100}%`,background:"var(--blue)"}}/></div>
              </div>
            ))}
            <div style={{marginTop:"12px",padding:"10px",background:"var(--bg)",borderRadius:"9px",textAlign:"center"}}>
              <div style={{fontSize:"0.75rem",color:"var(--muted)"}}>Konversiya</div>
              <div style={{fontWeight:800,fontSize:"1.4rem",color:"var(--green)"}}>{conv}%</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-hd"><h3>📚 Guruh daromadi</h3></div>
          <div style={{padding:"14px"}}>
            {groups.map(g=>{
              const inc=payments.filter(p=>p.groupId===g.id&&p.status==="paid").reduce((s,p)=>s+p.amount,0);
              return(
                <div key={g.id} style={{marginBottom:"10px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.83rem",marginBottom:"3px"}}><span>{g.name}</span><span style={{fontWeight:700,color:"var(--green)"}}>{fmt(inc)}</span></div>
                  <div className="progress-bar"><div className="progress-fill" style={{width:`${Math.min((inc/2000000)*100,100)}%`,background:"var(--green)"}}/></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TELEGRAM/SMS PAGE ────────────────────────────────────────────────────────
function TelegramPage({tgConfig,setTgConfig,users,payments,attendance,smsLog,setSmsLog,setNotifications}) {
  const [tab,setTab]=useState("config");
  const [token,setToken]=useState(tgConfig.token||"");
  const [chatId,setChatId]=useState(tgConfig.chatId||"");
  const [selStudent,setSelStudent]=useState("");
  const [msg,setMsg]=useState("");
  const [channel,setChannel]=useState("telegram");
  const students=users.filter(u=>u.role==="student");
  const debtors=payments.filter(p=>p.status==="unpaid").map(p=>users.find(u=>u.id===p.studentId)).filter(Boolean);
  const absent=attendance.filter(a=>a.date===today&&a.status==="absent").map(a=>users.find(u=>u.id===a.studentId)).filter(Boolean);

  const saveConfig=()=>{
    setTgConfig({token,chatId,connected:token.length>10});
    alert(token.length>10?"✅ Telegram bot ulantirildi! Xabarlar shu bot orqali yuboriladi.":"❌ Token noto'g'ri ko'rinadi");
  };

  const sendMsg=(to,text,type)=>{
    if(tgConfig.connected&&channel==="telegram"){
      alert(`✈️ Telegram orqali yuborildi!\nToken: ${tgConfig.token.slice(0,15)}...\nKimga: ${to}\nMatn: ${text}`);
    } else {
      alert(`📱 SMS yuborildi!\nKimga: ${to}\nMatn: ${text}`);
    }
    setSmsLog(p=>[{id:"s"+uid(),to,text,date:today,channel:tgConfig.connected&&channel==="telegram"?"telegram":"sms",type,status:"sent"},...p]);
    setNotifications(p=>[{id:"n"+uid(),forRoles:["admin","reception","superadmin"],text:`${channel==="telegram"?"Telegram":"SMS"} yuborildi: ${to}`,time:now(),type:"info",read:false},...p]);
  };

  const TEMPLATES=[
    {label:"Davomat eslatmasi",text:"Assalomu alaykum! Bugun darsga kelmadingiz. Iltimos, bog'laning."},
    {label:"To'lov eslatmasi",text:"Assalomu alaykum! To'lov muddatingiz o'tdi. Iltimos, to'lovni amalga oshiring."},
    {label:"Dars eslatmasi",text:"Assalomu alaykum! Ertaga dars bor. Vaqt: 09:00. Manzil: Lola Edu"},
    {label:"Imtihon eslatmasi",text:"Assalomu alaykum! Imtihon haqida eslatma: ertaga soat 10:00 da imtihon bor."},
  ];

  return(
    <div className="page-fade">
      <div className="tabs">
        {[["config","Bot sozlash"],["send","Xabar yuborish"],["bulk","Ommaviy"],["log","Tarix"]].map(([v,l])=>(
          <button key={v} className={`tab ${tab===v?"active":""}`} onClick={()=>setTab(v)}>{l}</button>
        ))}
      </div>

      {tab==="config"&&(
        <div style={{maxWidth:"520px"}}>
          <div className="tg-setup">
            <h4>✈️ Telegram Bot sozlash</h4>
            <p>1. @BotFather ga yozing va /newbot buyrug'ini yuboring<br/>2. Bot nomini kiriting<br/>3. Token oling va quyida kiriting<br/>4. Bot chatiga /start yuboring va Chat ID ni aniqlang</p>
            <input className="tg-token-input" value={token} onChange={e=>setToken(e.target.value)} placeholder="Bot token: 1234567890:AAF..."/>
          </div>
          <div className="fg"><label>Chat ID (guruh yoki kanal)</label><input value={chatId} onChange={e=>setChatId(e.target.value)} placeholder="-100123456789"/></div>
          <div style={{display:"flex",gap:"10px",alignItems:"center",marginBottom:"16px"}}>
            <span className={`badge ${tgConfig.connected?"green":"gray"}`}>{tgConfig.connected?"✅ Ulangan":"❌ Ulanmagan"}</span>
            {tgConfig.connected&&<span style={{fontSize:"0.8rem",color:"var(--muted)"}}>Token: {tgConfig.token.slice(0,15)}...</span>}
          </div>
          <button className="btn-red" onClick={saveConfig}>💾 Saqlash va ulash</button>
          <div style={{marginTop:"16px",padding:"14px",background:"var(--bg)",borderRadius:"10px",border:"1px solid var(--border)"}}>
            <div style={{fontSize:"0.8rem",fontWeight:700,marginBottom:"6px",color:"var(--muted)"}}>SMS integratsiya (Eskiz/Play Mobile)</div>
            <div style={{fontSize:"0.78rem",color:"var(--muted)"}}>Real SMS uchun Eskiz.uz yoki PlayMobile.uz API token kerak. Hozircha simulyatsiya rejimida ishlaydi.</div>
          </div>
        </div>
      )}

      {tab==="send"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
          <div className="card" style={{padding:"18px"}}>
            <h3 style={{fontSize:"0.95rem",fontFamily:"'DM Sans',sans-serif",fontWeight:700,marginBottom:"14px"}}>📤 Individual xabar</h3>
            <div className="fg"><label>Kanal</label>
              <select value={channel} onChange={e=>setChannel(e.target.value)}>
                <option value="telegram">✈️ Telegram {tgConfig.connected?"(Ulangan)":"(Ulanmagan)"}</option>
                <option value="sms">📱 SMS</option>
              </select>
            </div>
            <div className="fg"><label>Talaba</label><select value={selStudent} onChange={e=>setSelStudent(e.target.value)}><option value="">Tanlang</option>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="fg"><label>Xabar</label><textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={3} style={{width:"100%",padding:"9px 13px",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"0.85rem",fontFamily:"'DM Sans',sans-serif",background:"var(--bg)",resize:"vertical"}}/></div>
            <div style={{marginBottom:"12px"}}>
              <div style={{fontSize:"0.77rem",color:"var(--muted)",fontWeight:700,marginBottom:"6px"}}>Shablonlar:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                {TEMPLATES.map(t=><button key={t.label} onClick={()=>setMsg(t.text)} style={{padding:"4px 9px",borderRadius:"7px",border:"1px solid var(--border)",background:"var(--bg)",fontSize:"0.73rem",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{t.label}</button>)}
              </div>
            </div>
            <button className="btn-red" style={{width:"100%"}} onClick={()=>{const s=users.find(u=>u.id===selStudent);if(s&&msg)sendMsg(s.phone,msg,"individual");}}>
              {channel==="telegram"?"✈️ Telegram":"📱 SMS"} yuborish
            </button>
          </div>
          <div className="card" style={{padding:"18px"}}>
            <h3 style={{fontSize:"0.95rem",fontFamily:"'DM Sans',sans-serif",fontWeight:700,marginBottom:"14px"}}>📢 Avtomatik xabarlar</h3>
            {[
              {ico:"❌",title:`Kelmaganlarga (${absent.length} ta)`,list:absent,text:"Assalomu alaykum! Bugun darsga kelmadingiz. Iltimos, bog'laning.",type:"absent",color:"#ef4444"},
              {ico:"⚠️",title:`Qarzdorlarga (${debtors.length} ta)`,list:debtors,text:"Assalomu alaykum! To'lov muddatingiz o'tdi. Iltimos, to'lovni amalga oshiring.",type:"debt",color:"#f59e0b"},
            ].map((item,i)=>(
              <div key={i} style={{padding:"13px",background:"var(--bg)",borderRadius:"10px",border:"1px solid var(--border)",marginBottom:"10px"}}>
                <div style={{fontWeight:700,fontSize:"0.84rem",marginBottom:"3px"}}>{item.ico} {item.title}</div>
                <div style={{fontSize:"0.78rem",color:"var(--muted)",marginBottom:"9px"}}>{item.text.slice(0,60)}...</div>
                <button className="btn-red btn-sm" onClick={()=>item.list.forEach(u=>sendMsg(u.phone,item.text,item.type))}>
                  {channel==="telegram"?"✈️":"📱"} Barchasiga yuborish
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="bulk"&&(
        <div className="card" style={{padding:"18px",maxWidth:"500px"}}>
          <h3 style={{fontSize:"0.95rem",fontFamily:"'DM Sans',sans-serif",fontWeight:700,marginBottom:"14px"}}>📢 Ommaviy xabar</h3>
          <div className="fg"><label>Kanal</label><select value={channel} onChange={e=>setChannel(e.target.value)}><option value="telegram">✈️ Telegram</option><option value="sms">📱 SMS</option></select></div>
          <div className="fg"><label>Kimga</label><select><option>Barcha talabalar</option><option>Barcha ota-onalar</option><option>Faqat qarzdorlar</option><option>Faqat kelmaganlar</option></select></div>
          <div className="fg"><label>Xabar</label><textarea rows={4} style={{width:"100%",padding:"9px 13px",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"0.85rem",fontFamily:"'DM Sans',sans-serif",background:"var(--bg)",resize:"vertical"}} placeholder="Xabar matnini yozing..."/></div>
          <button className="btn-red" style={{width:"100%"}} onClick={()=>{students.forEach(s=>sendMsg(s.phone,"Ommaviy xabar","bulk"));}}>📤 Yuborish ({students.length} ta)</button>
        </div>
      )}

      {tab==="log"&&(
        <div className="card">
          <table>
            <thead><tr><th>Kimga</th><th>Xabar</th><th>Kanal</th><th>Tur</th><th>Holat</th><th>Sana</th></tr></thead>
            <tbody>
              {smsLog.map(s=>(
                <tr key={s.id}>
                  <td style={{fontSize:"0.83rem",fontWeight:500}}>{s.to}</td>
                  <td style={{fontSize:"0.8rem",color:"var(--muted)",maxWidth:"250px"}}>{s.text}</td>
                  <td><span className={`badge ${s.channel==="telegram"?"blue":"green"}`}>{s.channel==="telegram"?"✈️ TG":"📱 SMS"}</span></td>
                  <td style={{fontSize:"0.8rem"}}>{s.type}</td>
                  <td><span className="badge green">{s.status}</span></td>
                  <td style={{fontSize:"0.8rem",color:"var(--muted)"}}>{s.date}</td>
                </tr>
              ))}
              {smsLog.length===0&&<tr><td colSpan={6}><div className="empty">Tarix yo'q</div></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── BRANCHES PAGE ────────────────────────────────────────────────────────────
function BranchesPage({branches,setBranches,users,payments,groups}) {
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({name:"",address:"",phone:"",directorId:""});
  const open=b=>{setForm(b||{name:"",address:"",phone:"",directorId:""});setModal(b||"new");};
  const save=()=>{
    if(modal==="new") setBranches(p=>[...p,{...form,id:"b"+uid()}]);
    else setBranches(p=>p.map(b=>b.id===modal.id?{...b,...form}:b));
    setModal(null);
  };
  return(
    <div className="page-fade">
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"16px"}}>
        <button className="btn-red" onClick={()=>open(null)}>+ Filial qo'shish</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"14px"}}>
        {branches.map(b=>{
          const bStudents=users.filter(u=>u.role==="student"&&u.branchId===b.id).length;
          const bTeachers=users.filter(u=>u.role==="teacher"&&u.branchId===b.id).length;
          const bGroups=groups.filter(g=>g.branchId===b.id).length;
          const bIncome=payments.filter(p=>p.status==="paid"&&users.find(u=>u.id===p.studentId)?.branchId===b.id).reduce((s,p)=>s+p.amount,0);
          const dir=users.find(u=>u.id===b.directorId);
          return(
            <div key={b.id} className="card" style={{padding:"20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px"}}>
                <h3 style={{fontSize:"0.95rem",fontFamily:"'DM Sans',sans-serif"}}>{b.name}</h3>
                <button className="btn-ghost btn-sm" onClick={()=>open(b)}>✏️</button>
              </div>
              <div style={{fontSize:"0.8rem",color:"var(--muted)",marginBottom:"3px"}}>📍 {b.address}</div>
              <div style={{fontSize:"0.8rem",color:"var(--muted)",marginBottom:"3px"}}>📞 {b.phone}</div>
              {dir&&<div style={{fontSize:"0.8rem",color:"var(--muted)",marginBottom:"12px"}}>👤 {dir.name}</div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginTop:"12px"}}>
                {[["👩‍🎓",bStudents,"Talaba"],["👨‍🏫",bTeachers,"O'qituvchi"],["📚",bGroups,"Guruh"],["💰",fmt(bIncome),"Daromad"]].map(([ico,v,l])=>(
                  <div key={l} style={{background:"var(--bg)",padding:"9px",borderRadius:"9px",textAlign:"center"}}>
                    <div style={{fontSize:"1rem"}}>{ico}</div>
                    <div style={{fontWeight:700,fontSize:"0.88rem"}}>{v}</div>
                    <div style={{fontSize:"0.72rem",color:"var(--muted)"}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {modal&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <h3>{modal==="new"?"Yangi filial":"Filialini tahrirlash"}</h3>
            <div className="fg"><label>Filial nomi</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
            <div className="fg"><label>Manzil</label><input value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))}/></div>
            <div className="fg"><label>Telefon</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/></div>
            <div className="fg"><label>Direktor</label><select value={form.directorId} onChange={e=>setForm(p=>({...p,directorId:e.target.value}))}><option value="">Tanlang</option>{users.filter(u=>["admin","branch_dir"].includes(u.role)).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div className="ma"><button className="btn-ghost" onClick={()=>setModal(null)}>Bekor</button><button className="btn-red" onClick={save}>Saqlash</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── USERS MANAGEMENT ─────────────────────────────────────────────────────────
function UsersPage({users,setUsers,branches}) {
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({name:"",email:"",phone:"",role:"student",password:"1234",branchId:"b1"});
  const [search,setSearch]=useState("");
  const roles=Object.keys(ROLE_LABELS);
  const filtered=users.filter(u=>u.name.toLowerCase().includes(search.toLowerCase())||u.email?.includes(search));
  const open=u=>{setForm(u||{name:"",email:"",phone:"",role:"student",password:"1234",branchId:"b1"});setModal(u||"new");};
  const save=()=>{
    if(modal==="new") setUsers(p=>[...p,{...form,id:"u"+uid()}]);
    else setUsers(p=>p.map(u=>u.id===modal.id?{...u,...form}:u));
    setModal(null);
  };
  const del=id=>{if(confirm("O'chirishni tasdiqlaysizmi?"))setUsers(p=>p.filter(u=>u.id!==id));};
  return(
    <div className="page-fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}}>
        <input className="search-input" placeholder="🔍 Qidirish..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <button className="btn-red" onClick={()=>open(null)}>+ Foydalanuvchi qo'shish</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Foydalanuvchi</th><th>Email</th><th>Rol</th><th>Filial</th><th>Telefon</th><th>Amal</th></tr></thead>
          <tbody>
            {filtered.map(u=>{
              const branch=branches.find(b=>b.id===u.branchId);
              return(
                <tr key={u.id}>
                  <td><div className="flex items-center gap2"><div className="avatar">{ini(u.name)}</div><span style={{fontWeight:500}}>{u.name}</span></div></td>
                  <td style={{fontSize:"0.81rem",color:"var(--muted)"}}>{u.email}</td>
                  <td><span className={`badge ${ROLE_COLORS[u.role]||"gray"}`}>{ROLE_LABELS[u.role]||u.role}</span></td>
                  <td style={{fontSize:"0.81rem"}}>{branch?.name||"—"}</td>
                  <td style={{fontSize:"0.81rem"}}>{u.phone}</td>
                  <td><div className="flex gap2"><button className="btn-ghost btn-sm" onClick={()=>open(u)}>✏️</button><button className="btn-red btn-sm" onClick={()=>del(u.id)}>🗑️</button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {modal&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <h3>{modal==="new"?"Yangi foydalanuvchi":"Tahrirlash"}</h3>
            {[["name","Ism-familiya"],["email","Email"],["phone","Telefon"],["password","Parol"]].map(([f,l])=>(
              <div key={f} className="fg"><label>{l}</label><input value={form[f]||""} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))}/></div>
            ))}
            <div className="fg2">
              <div className="fg"><label>Rol</label><select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}>{roles.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
              <div className="fg"><label>Filial</label><select value={form.branchId||""} onChange={e=>setForm(p=>({...p,branchId:e.target.value}))}><option value="">Tanlang</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            </div>
            <div className="ma"><button className="btn-ghost" onClick={()=>setModal(null)}>Bekor</button><button className="btn-red" onClick={save}>Saqlash</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function SettingsPage({branches}) {
  const branch=branches[0];
  return(
    <div className="page-fade">
      <div className="card" style={{padding:"22px",maxWidth:"500px"}}>
        <h3 style={{marginBottom:"18px",fontSize:"1rem",fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>🌸 Markaz sozlamalari</h3>
        {[["Markaz nomi","Lola Edu"],["Manzil",branch?.address||""],["Telefon",branch?.phone||""],["Email","info@lola.uz"],["Veb-sayt","www.lola-edu.uz"]].map(([k,v])=>(
          <div key={k} className="fg"><label>{k}</label><input defaultValue={v}/></div>
        ))}
        <button className="btn-red">💾 Saqlash</button>
      </div>
    </div>
  );
}

// ─── STUDENT PAGES ────────────────────────────────────────────────────────────
function MyGroupsPage({cu,groups,users,attendance}) {
  const mg=groups.filter(g=>g.teacherId===cu.id);
  const [sg,setSg]=useState(mg[0]?.id||"");
  const group=groups.find(g=>g.id===sg);
  const students=(group?.students||[]).map(id=>users.find(u=>u.id===id)).filter(Boolean);
  const pct=(sid)=>{const all=attendance.filter(a=>a.studentId===sid&&a.groupId===sg);return all.length?Math.round((all.filter(a=>a.status==="present").length/all.length)*100):0;};
  return(
    <div className="page-fade">
      <div className="tabs">{mg.map(g=><button key={g.id} className={`tab ${sg===g.id?"active":""}`} onClick={()=>setSg(g.id)}>{g.name}</button>)}</div>
      {group&&<div className="card">
        <div className="card-hd"><h3>👥 {group.name}</h3><span className="badge blue">{students.length} ta</span></div>
        <table><thead><tr><th>Talaba</th><th>Telefon</th><th>Davomat</th></tr></thead>
          <tbody>{students.map(s=>{const p=pct(s.id);return(
            <tr key={s.id}>
              <td><div className="flex items-center gap2"><div className="avatar">{ini(s.name)}</div>{s.name}</div></td>
              <td style={{color:"var(--muted)",fontSize:"0.83rem"}}>{s.phone}</td>
              <td style={{width:"180px"}}><div style={{display:"flex",alignItems:"center",gap:"9px"}}><div className="progress-bar" style={{flex:1}}><div className="progress-fill" style={{width:`${p}%`,background:p>=70?"var(--green)":"var(--red)"}}/></div><span style={{fontSize:"0.8rem",fontWeight:700,minWidth:"32px"}}>{p}%</span></div></td>
            </tr>);})}</tbody>
        </table>
      </div>}
    </div>
  );
}

function MyAttendancePage({cu,attendance,groups}) {
  const att=attendance.filter(a=>a.studentId===cu.id);
  const group=groups.find(g=>g.id===cu.groupId);
  const total=att.length;
  const present=att.filter(a=>a.status==="present").length;
  const pct=total?Math.round((present/total)*100):0;
  return(
    <div className="page-fade">
      <div className="stat-grid" style={{marginBottom:"18px"}}>
        <div className="stat-card" style={{"--accent":"#10b981"}}><div className="ico2">✅</div><div className="val">{present}</div><div className="lbl">Kelgan kunlar</div></div>
        <div className="stat-card" style={{"--accent":"#ef4444"}}><div className="ico2">❌</div><div className="val">{att.filter(a=>a.status==="absent").length}</div><div className="lbl">Kelmagan</div></div>
        <div className="stat-card" style={{"--accent":"#f59e0b"}}><div className="ico2">🕐</div><div className="val">{att.filter(a=>a.status==="late").length}</div><div className="lbl">Kech kelgan</div></div>
        <div className="stat-card" style={{"--accent":pct>=70?"#10b981":"#C8102E"}}><div className="ico2">📊</div><div className="val">{pct}%</div><div className="lbl">Umumiy</div></div>
      </div>
      <div className="card"><table><thead><tr><th>Sana</th><th>Guruh</th><th>Holat</th></tr></thead>
        <tbody>{att.sort((a,b)=>b.date.localeCompare(a.date)).map(a=>(
          <tr key={a.id}><td>{a.date}</td><td>{group?.name||"—"}</td><td><span className={`chip ${a.status}`}>{a.status==="present"?"✅ Keldi":a.status==="absent"?"❌ Kelmadi":"🕐 Kech keldi"}</span></td></tr>
        ))}
        {att.length===0&&<tr><td colSpan={3}><div className="empty">Ma'lumot yo'q</div></td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

function MyPaymentsPage({cu,payments,groups}) {
  const p=payments.filter(x=>x.studentId===cu.id);
  const total=p.reduce((s,x)=>s+x.amount,0);
  const paid=p.filter(x=>x.status==="paid").reduce((s,x)=>s+x.amount,0);
  return(
    <div className="page-fade">
      <div className="stat-grid" style={{marginBottom:"18px"}}>
        <div className="stat-card" style={{"--accent":"#3b82f6"}}><div className="ico2">💳</div><div className="val" style={{fontSize:"1rem"}}>{fmt(total)}</div><div className="lbl">Jami</div></div>
        <div className="stat-card" style={{"--accent":"#10b981"}}><div className="ico2">✅</div><div className="val" style={{fontSize:"1rem"}}>{fmt(paid)}</div><div className="lbl">To'langan</div></div>
        <div className="stat-card" style={{"--accent":total-paid>0?"#ef4444":"#10b981"}}><div className="ico2">{total-paid>0?"⚠️":"✅"}</div><div className="val" style={{fontSize:"1rem"}}>{fmt(total-paid)}</div><div className="lbl">Qarzdorlik</div></div>
      </div>
      <div className="card"><table><thead><tr><th>Oy</th><th>Summa</th><th>Usul</th><th>Holat</th></tr></thead>
        <tbody>{p.map(x=>(
          <tr key={x.id}><td style={{fontWeight:500}}>{x.month}</td><td style={{fontWeight:700}}>{fmt(x.amount)}</td><td style={{fontSize:"0.83rem"}}>{x.method}</td><td><span className={`badge ${x.status==="paid"?"green":"red"}`}>{x.status==="paid"?"✅ To'langan":"❌ Qarzdor"}</span></td></tr>
        ))}
        {p.length===0&&<tr><td colSpan={4}><div className="empty">Ma'lumot yo'q</div></td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

function MyGradesPage({cu,grades,groups}) {
  const g=grades.filter(x=>x.studentId===cu.id);
  const group=groups.find(gr=>gr.id===cu.groupId);
  const avg=g.length?Math.round(g.reduce((s,x)=>s+(x.score/x.maxScore)*100,0)/g.length):0;
  const sc=p=>p>=80?"#10b981":p>=60?"#f59e0b":"#ef4444";
  return(
    <div className="page-fade">
      <div className="stat-grid" style={{marginBottom:"18px"}}>
        <div className="stat-card" style={{"--accent":"#3b82f6"}}><div className="ico2">📝</div><div className="val">{g.length}</div><div className="lbl">Jami baholar</div></div>
        <div className="stat-card" style={{"--accent":avg>=70?"#10b981":"#C8102E"}}><div className="ico2">⭐</div><div className="val">{avg}%</div><div className="lbl">O'rtacha ball</div></div>
      </div>
      <div className="card"><table><thead><tr><th>Tur</th><th>Sarlavha</th><th>Ball</th><th>Foiz</th><th>Sana</th><th>Izoh</th></tr></thead>
        <tbody>{g.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>{const pct=Math.round((x.score/x.maxScore)*100);return(
          <tr key={x.id}>
            <td><span className="badge blue">{GRADE_TYPES.find(t=>t.k===x.type)?.l||x.type}</span></td>
            <td style={{fontWeight:500}}>{x.title}</td>
            <td><strong>{x.score}</strong>/{x.maxScore}</td>
            <td><div className="grade-circle" style={{background:sc(pct)+"20",color:sc(pct)}}>{pct}%</div></td>
            <td style={{fontSize:"0.8rem",color:"var(--muted)"}}>{x.date}</td>
            <td style={{fontSize:"0.8rem",color:"var(--muted)"}}>{x.teacherNote||"—"}</td>
          </tr>);})}
          {g.length===0&&<tr><td colSpan={6}><div className="empty">Baholar yo'q</div></td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

// ─── PARENT PAGES ─────────────────────────────────────────────────────────────
function ChildAttendancePage({cu,users,attendance,groups}) {
  const child=users.find(u=>u.id===cu.childId);
  const att=attendance.filter(a=>a.studentId===child?.id);
  const group=groups.find(g=>g.id===child?.groupId);
  return(
    <div className="page-fade">
      {child&&<div style={{background:"var(--card)",borderRadius:"12px",padding:"16px",border:"1px solid var(--border)",marginBottom:"18px",display:"flex",alignItems:"center",gap:"12px"}}>
        <div className="avatar" style={{width:"42px",height:"42px",fontSize:"1rem"}}>{ini(child.name)}</div>
        <div><div style={{fontWeight:700,fontSize:"1rem"}}>{child.name}</div><div style={{fontSize:"0.8rem",color:"var(--muted)"}}>{group?.name||"—"}</div></div>
      </div>}
      <div className="card"><table><thead><tr><th>Sana</th><th>Holat</th></tr></thead>
        <tbody>{att.sort((a,b)=>b.date.localeCompare(a.date)).map(a=>(
          <tr key={a.id}><td>{a.date}</td><td><span className={`chip ${a.status}`}>{a.status==="present"?"✅ Keldi":a.status==="absent"?"❌ Kelmadi":"🕐 Kech keldi"}</span></td></tr>
        ))}
        {att.length===0&&<tr><td colSpan={2}><div className="empty">Ma'lumot yo'q</div></td></tr>}
        </tbody>
      </table></div>
    </div>
  );
}

function ChildGradesPage({cu,users,grades,groups}) {
  const child=users.find(u=>u.id===cu.childId);
  return <MyGradesPage cu={child||cu} grades={grades} groups={groups}/>;
}

function ChildPaymentsPage({cu,users,payments,groups}) {
  const child=users.find(u=>u.id===cu.childId);
  return <MyPaymentsPage cu={child||cu} payments={payments} groups={groups}/>;
}

// ─── COURSES PAGE ─────────────────────────────────────────────────────────────
function CoursesPage({courses,setCourses}) {
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({name:"",duration:"",price:"",description:""});
  const open=c=>{setForm(c||{name:"",duration:"",price:"",description:""});setModal(c||"new");};
  const save=()=>{
    if(modal==="new") setCourses(p=>[...p,{...form,id:"c"+uid(),price:Number(form.price)}]);
    else setCourses(p=>p.map(c=>c.id===modal.id?{...c,...form,price:Number(form.price)}:c));
    setModal(null);
  };
  return(
    <div className="page-fade">
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"16px"}}>
        <button className="btn-red" onClick={()=>open(null)}>+ Kurs qo'shish</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"14px"}}>
        {courses.map(c=>(
          <div key={c.id} className="card" style={{padding:"18px"}}>
            <div style={{fontSize:"1.8rem",marginBottom:"8px"}}>🎓</div>
            <h3 style={{fontSize:"0.95rem",marginBottom:"5px"}}>{c.name}</h3>
            <p style={{fontSize:"0.8rem",color:"var(--muted)",marginBottom:"12px"}}>{c.description}</p>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
              <div><div style={{fontSize:"0.73rem",color:"var(--muted)"}}>Davomiyligi</div><div style={{fontWeight:700,fontSize:"0.88rem"}}>{c.duration}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:"0.73rem",color:"var(--muted)"}}>Narxi</div><div style={{fontWeight:800,fontSize:"0.95rem",color:"var(--red)"}}>{fmt(c.price)}</div></div>
            </div>
            <button className="btn-ghost btn-sm" style={{width:"100%"}} onClick={()=>open(c)}>✏️ Tahrirlash</button>
          </div>
        ))}
      </div>
      {modal&&(
        <div className="modal-ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <h3>{modal==="new"?"Yangi kurs":"Kursni tahrirlash"}</h3>
            {[["name","Kurs nomi"],["duration","Davomiyligi"],["price","Narxi (so'm)"],["description","Tavsif"]].map(([f,l])=>(
              <div key={f} className="fg"><label>{l}</label><input value={form[f]||""} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))}/></div>
            ))}
            <div className="ma"><button className="btn-ghost" onClick={()=>setModal(null)}>Bekor</button><button className="btn-red" onClick={save}>Saqlash</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SMS PAGE (reception/manager) ─────────────────────────────────────────────
function SmsPage(props) { return <TelegramPage {...props}/>; }

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [cu,setCu]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [users,setUsersState]=useState(USERS0);
  const [branches,setBranchesState]=useState(BRANCHES0);
  const [groups,setGroupsState]=useState(GROUPS0);
  const [courses,setCoursesState]=useState(COURSES0);
  const [attendance,setAttendanceState]=useState(ATTENDANCE0);
  const [payments,setPaymentsState]=useState(PAYMENTS0);
  const [expenses,setExpensesState]=useState(EXPENSES0);
  const [leads,setLeadsState]=useState(LEADS0);
  const [grades,setGradesState]=useState(GRADES0);
  const [salaries,setSalariesState]=useState(SALARIES0);
  const [notifications,setNotificationsState]=useState(NOTIFICATIONS0);
  const [smsLog,setSmsLogState]=useState(SMSLOG0);
  const [tgConfig,setTgConfig]=useState(TGCONFIG0);
  const [dbReady,setDbReady]=useState(false);

  // Supabase dan ma'lumotlarni yuklash
  useEffect(()=>{
    async function loadData() {
      try {
        const [u,b,gr,c,at,p,e,l,g,s,n,sm]=await Promise.all([
          dbGet('users'),dbGet('branches'),dbGet('groups'),dbGet('courses'),
          dbGet('attendance'),dbGet('payments'),dbGet('expenses'),dbGet('leads'),
          dbGet('grades'),dbGet('salaries'),dbGet('notifications'),dbGet('sms_log')
        ]);
        if(u.length) setUsersState(u);
        if(b.length) setBranchesState(b);
        if(gr.length) setGroupsState(gr.map(g=>({...g,students:Array.isArray(g.students)?g.students:JSON.parse(g.students||'[]')})));
        if(c.length) setCoursesState(c);
        if(at.length) setAttendanceState(at);
        if(p.length) setPaymentsState(p);
        if(e.length) setExpensesState(e);
        if(l.length) setLeadsState(l);
        if(g.length) setGradesState(g);
        if(s.length) setSalariesState(s);
        if(n.length) setNotificationsState(n.map(x=>({...x,forRoles:Array.isArray(x.for_roles)?x.for_roles:JSON.parse(x.for_roles||'[]')})));
        if(sm.length) setSmsLogState(sm);
        setDbReady(true);
      } catch(err) {
        console.error('DB load error:', err);
        setDbReady(true);
      }
    }
    loadData();
  },[]);

  // Setter wrappers - state va DB ga birga yozadi
  const makeDbSetter = (table, setState, current) => async (fn) => {
    const next = typeof fn === 'function' ? fn(current) : fn;
    setState(next);
    const added = next.find(i => !current.find(x => x.id === i.id));
    const changed = next.find(i => { const old=current.find(x=>x.id===i.id); return old&&JSON.stringify(old)!==JSON.stringify(i); });
    if(added) await dbUpsert(table, added);
    if(changed) await dbUpsert(table, changed);
    if(next.length < current.length) {
      const removed = current.find(i => !next.find(x => x.id === i.id));
      if(removed) await dbDelete(table, removed.id);
    }
  };

  const setUsers = makeDbSetter('users', setUsersState, users);
  const setBranches = makeDbSetter('branches', setBranchesState, branches);
  const setGroups = makeDbSetter('groups', setGroupsState, groups);
  const setCourses = makeDbSetter('courses', setCoursesState, courses);
  const setAttendance = makeDbSetter('attendance', setAttendanceState, attendance);
  const setPayments = makeDbSetter('payments', setPaymentsState, payments);
  const setExpenses = makeDbSetter('expenses', setExpensesState, expenses);
  const setLeads = makeDbSetter('leads', setLeadsState, leads);
  const setGrades = makeDbSetter('grades', setGradesState, grades);
  const setSalaries = makeDbSetter('salaries', setSalariesState, salaries);
  const setNotifications = makeDbSetter('notifications', setNotificationsState, notifications);
  const setSmsLog = makeDbSetter('sms_log', setSmsLogState, smsLog);

  if(!cu) return(
    <>
      <style>{STYLE}</style>
      <LoginPage onLogin={u=>{setCu(u);setPage("dashboard");}}/>
    </>
  );

  const nav=NAV[cu.role]||NAV.student;
  const props={users,setUsers,branches,setBranches,groups,setGroups,courses,setCourses,
    attendance,setAttendance,payments,setPayments,expenses,setExpenses,
    leads,setLeads,grades,setGrades,salaries,setSalaries,
    notifications,setNotifications,smsLog,setSmsLog,tgConfig,setTgConfig,cu};

  const renderPage=()=>{
    switch(page){
      case "dashboard":
        if(["superadmin","admin"].includes(cu.role)) return <SuperAdminDash {...props}/>;
        if(cu.role==="manager"||cu.role==="reception") return <ManagerDash {...props}/>;
        if(cu.role==="teacher") return <TeacherDash {...props}/>;
        if(cu.role==="finance") return <SuperAdminDash {...props}/>;
        if(cu.role==="branch_dir") return <SuperAdminDash {...props}/>;
        if(cu.role==="parent") return <ParentDash {...props}/>;
        if(cu.role==="student") return <StudentDash {...props}/>;
        return null;
      case "branches": return <BranchesPage {...props}/>;
      case "students": return <StudentsPage {...props}/>;
      case "teachers": return <TeachersPage {...props}/>;
      case "groups": return <GroupsPage {...props}/>;
      case "courses": return <CoursesPage {...props}/>;
      case "leads": return <LeadsPage {...props}/>;
      case "attendance": case "attendance_view": return <AttendancePage {...props}/>;
      case "attendance_mark": return <AttendanceMarkPage {...props}/>;
      case "grades": return <GradesPage {...props}/>;
      case "payments": return <PaymentsPage {...props}/>;
      case "expenses": return <ExpensesPage {...props}/>;
      case "salary": return <SalaryPage {...props}/>;
      case "reports": return <ReportsPage {...props}/>;
      case "telegram": case "sms": return <TelegramPage {...props}/>;
      case "users": return <UsersPage {...props}/>;
      case "settings": return <SettingsPage {...props}/>;
      case "my_groups": return <MyGroupsPage {...props}/>;
      case "my_schedule": return <StudentDash {...props}/>;
      case "my_attendance": return <MyAttendancePage {...props}/>;
      case "my_grades": return <MyGradesPage {...props}/>;
      case "my_payments": return <MyPaymentsPage {...props}/>;
      case "child_attendance": return <ChildAttendancePage {...props}/>;
      case "child_grades": return <ChildGradesPage {...props}/>;
      case "child_payments": return <ChildPaymentsPage {...props}/>;
      default: return <div className="empty page-fade">Sahifa topilmadi</div>;
    }
  };

  return(
    <>
      <style>{STYLE}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <span style={{fontSize:"1.7rem"}}>🌸</span>
            <div><h2>Lola Edu</h2><span>Boshqaruv tizimi</span></div>
          </div>
          <nav className="sidebar-nav">
            {nav.map((item,i)=>
              item.section
                ? <div key={i} className="nav-section">{item.section}</div>
                : <div key={item.key} className={`nav-item ${page===item.key?"active":""}`} onClick={()=>setPage(item.key)}>
                    <span className="ico">{item.ico}</span><span>{item.label}</span>
                  </div>
            )}
          </nav>
          <div className="sidebar-user">
            <div className="user-card">
              <div className="u-av">{ini(cu.name)}</div>
              <div><div className="u-name">{cu.name}</div><div className="u-role">{ROLE_LABELS[cu.role]||cu.role}</div></div>
            </div>
            <button className="logout-btn" onClick={()=>{setCu(null);setPage("dashboard");}}>🚪 Chiqish</button>
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <h2>{PAGE_TITLES[page]||"Dashboard"}</h2>
            <div className="topbar-right">
              {tgConfig.connected&&<span className="badge blue" style={{fontSize:"0.73rem"}}>✈️ TG Ulangan</span>}
              <NotifBell notifications={notifications} setNotifications={setNotifications} role={cu.role}/>
            </div>
          </header>
          <div className="content">{renderPage()}</div>
        </main>
      </div>
    </>
  );
}
