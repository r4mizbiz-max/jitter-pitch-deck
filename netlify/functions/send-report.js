// Emails the Local Authority Audit via Resend, from a verified Jitter Growth domain.
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.AUDIT_FROM || 'Jitter Growth <reports@appointments.jittergrowth.com>';

const esc = (s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money = (n)=> '$'+Number(n).toLocaleString('en-US');
const gradeOf = (s)=> s==null?null:(s>=90?'A':s>=85?'A-':s>=80?'B+':s>=75?'B':s>=70?'B-':s>=65?'C+':s>=60?'C':s>=55?'C-':s>=50?'D+':s>=45?'D':'F');

function metricRow(l,v){ return `<tr><td style="padding:7px 0;color:#5b6472;font-size:14px;border-bottom:1px solid #eef0f3">${esc(l)}</td><td style="padding:7px 0;text-align:right;font-weight:700;color:#0d1117;font-size:14px;border-bottom:1px solid #eef0f3">${v}</td></tr>`; }
function sectionCard(title, rowsHtml){
  if(!rowsHtml) return '';
  return `<div style="border:1px solid #e6e8ec;border-radius:12px;padding:16px 18px;margin-bottom:14px">
    <div style="font-weight:800;font-size:15px;color:#0d1117;margin-bottom:8px">${esc(title)}</div>
    <table style="width:100%;border-collapse:collapse">${rowsHtml}</table></div>`;
}

function buildHtml(d){
  const g=d.gmb||{}, rv=d.reviews||{}, w=d.website_g||{}, m=d.market||{};
  const overall=d.overall, grade=d.grade||gradeOf(overall);

  let gmbRows='';
  if(g.claimed!=null) gmbRows+=metricRow('Profile status', g.claimed?'Listed &amp; active':'Not verified');
  if(g.rating!=null) gmbRows+=metricRow('Google rating', g.rating+'★');
  if(g.reviews!=null) gmbRows+=metricRow('Total reviews', g.reviews+(g.compReviews?` (top rival ${g.compReviews})`:''));
  if(g.rank!=null) gmbRows+=metricRow('Local rank', '#'+g.rank);
  if(g.photos!=null) gmbRows+=metricRow('Profile photos', g.photos);

  let revRows='';
  if(rv.rating!=null) revRows+=metricRow('Average rating', rv.rating+'★');
  if(rv.recency!=null) revRows+=metricRow('Most recent review', rv.recency+' week'+(rv.recency===1?'':'s')+' ago');

  let webRows='';
  if(w.visual!=null) webRows+=metricRow('Accessibility', w.visual+'/100');
  if(w.seo!=null) webRows+=metricRow('SEO', w.seo+'/100');
  if(w.structure!=null) webRows+=metricRow('Best practices', w.structure+'/100');
  if(w.mobile!=null) webRows+=metricRow('Mobile speed', w.mobile+'/100');

  let mktRows='';
  if(m.medianHome) mktRows+=metricRow('Median home value', money(m.medianHome));
  if(m.population) mktRows+=metricRow('Population', Number(m.population).toLocaleString('en-US'));
  if(m.households) mktRows+=metricRow('Households', Number(m.households).toLocaleString('en-US'));
  if(m.medianIncome) mktRows+=metricRow('Median household income', money(m.medianIncome));

  const ringColor = overall==null?'#2f6bff':(overall>=75?'#27d08a':overall>=62?'#2f6bff':overall>=52?'#d69a1f':'#e23b4e');

  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:24px">
    <div style="background:#0b1222;border-radius:16px 16px 0 0;padding:24px 28px;color:#fff">
      <div style="font-size:13px;font-weight:800;letter-spacing:1px;color:#5c8bff;text-transform:uppercase">Jitter Growth · Local Authority Audit</div>
      <div style="font-size:24px;font-weight:800;margin-top:8px">${esc(d.company)}</div>
      ${d.website?`<div style="color:#8fb0ff;font-size:14px;margin-top:2px">${esc(String(d.website).replace(/^https?:\/\//,''))}</div>`:''}
      ${overall!=null?`<div style="display:inline-block;margin-top:14px;background:${ringColor};color:#fff;font-weight:800;font-size:15px;padding:7px 16px;border-radius:999px">Authority score: ${grade} · ${overall}/100</div>`:''}
    </div>
    <div style="background:#fff;border-radius:0 0 16px 16px;padding:24px 28px">
      ${m.medianHome||m.population?sectionCard('Local market'+(d.city?' — '+d.city:''), mktRows):''}
      ${sectionCard('Google Business Profile', gmbRows)}
      ${sectionCard('Reviews', revRows)}
      ${sectionCard('Website (live-tested)', webRows)}
      ${d.fbUrl?`<div style="border:1px solid #e6e8ec;border-radius:12px;padding:16px 18px;margin-bottom:14px">
        <div style="font-weight:800;font-size:15px;color:#0d1117;margin-bottom:6px">Facebook Ads</div>
        <a href="${esc(d.fbUrl)}" style="color:#2f6bff;font-weight:700;text-decoration:none;font-size:14px">See their live ads in Meta's Ad Library →</a></div>`:''}
      <div style="margin-top:18px;padding:16px 18px;background:#f6f8fc;border-radius:12px;color:#2b3240;font-size:14px;line-height:1.55">
        Want to dominate your local market? <b>Jitter Growth</b> fills your calendar with qualified, ready-to-buy homeowners — done for you.
        <br><a href="https://jittergrowth.com" style="color:#2f6bff;font-weight:700;text-decoration:none">Book a call →</a>
      </div>
      <div style="margin-top:16px;color:#9aa3b2;font-size:11.5px;line-height:1.5">
        Data pulled live from Google (Places &amp; PageSpeed) and the U.S. Census Bureau at the time of this audit. Figures reflect public records and may change.
      </div>
    </div>
  </div></body></html>`;
}

exports.handler = async (event) => {
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(event.httpMethod==='OPTIONS') return {statusCode:204,headers,body:''};
  if(!RESEND_API_KEY) return {statusCode:200,headers,body:JSON.stringify({ok:false,error:'email not configured'})};
  let d={}; try{ d=JSON.parse(event.body||'{}'); }catch(e){}
  const to=(d.toEmail||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return {statusCode:400,headers,body:JSON.stringify({ok:false,error:'valid email required'})};
  if(!d.company) return {statusCode:400,headers,body:JSON.stringify({ok:false,error:'company required'})};
  try{
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+RESEND_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({ from:FROM, to:[to], subject:`Your Local Authority Audit — ${d.company}`, html:buildHtml(d) })});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) return {statusCode:200,headers,body:JSON.stringify({ok:false,error:(j&&j.message)||('resend '+r.status)})};
    return {statusCode:200,headers,body:JSON.stringify({ok:true,id:j.id})};
  }catch(e){ return {statusCode:200,headers,body:JSON.stringify({ok:false,error:String(e)})}; }
};
