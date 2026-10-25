// Local Authority Audit — REAL DATA ONLY. No placeholders, no simulation.
// A field is returned only when a live source actually provides it.
//   • Google Places API -> GMB claimed/rating/reviews/rank/photos + top-competitor reviews  (env: GOOGLE_PLACES_KEY)
//   • US Census ACS 2022 -> population/households/median home value/median income           (env: CENSUS_KEY)
// Website grade (PageSpeed) is run client-side so this function stays fast.

const PLACES_KEY = process.env.GOOGLE_PLACES_KEY || '';
const CENSUS_KEY = process.env.CENSUS_KEY || '';

const STATE_FIPS = {AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56'};
const STATE_NAMES = {ALABAMA:'AL',ALASKA:'AK',ARIZONA:'AZ',ARKANSAS:'AR',CALIFORNIA:'CA',COLORADO:'CO',CONNECTICUT:'CT',DELAWARE:'DE',FLORIDA:'FL',GEORGIA:'GA',HAWAII:'HI',IDAHO:'ID',ILLINOIS:'IL',INDIANA:'IN',IOWA:'IA',KANSAS:'KS',KENTUCKY:'KY',LOUISIANA:'LA',MAINE:'ME',MARYLAND:'MD',MASSACHUSETTS:'MA',MICHIGAN:'MI',MINNESOTA:'MN',MISSISSIPPI:'MS',MISSOURI:'MO',MONTANA:'MT',NEBRASKA:'NE',NEVADA:'NV','NEW HAMPSHIRE':'NH','NEW JERSEY':'NJ','NEW MEXICO':'NM','NEW YORK':'NY','NORTH CAROLINA':'NC','NORTH DAKOTA':'ND',OHIO:'OH',OKLAHOMA:'OK',OREGON:'OR',PENNSYLVANIA:'PA','RHODE ISLAND':'RI','SOUTH CAROLINA':'SC','SOUTH DAKOTA':'SD',TENNESSEE:'TN',TEXAS:'TX',UTAH:'UT',VERMONT:'VT',VIRGINIA:'VA',WASHINGTON:'WA','WEST VIRGINIA':'WV',WISCONSIN:'WI',WYOMING:'WY'};

async function withTimeout(fn, ms){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); try{ return await fn(c.signal); } finally{ clearTimeout(t); } }
async function getJSON(url, signal){ const r=await fetch(url,{signal}); if(!r.ok) throw new Error('http '+r.status); return r.json(); }

function parseCity(city){
  if(!city) return null;
  const parts=city.split(',').map(s=>s.trim()).filter(Boolean);
  const name=parts[0]||''; let st=(parts[1]||'').toUpperCase();
  if(!name) return null;
  const abbr = STATE_FIPS[st] ? st : STATE_NAMES[st];
  if(!abbr) return null;
  return { name, abbr, fips: STATE_FIPS[abbr] };
}

async function fetchPlaces(company, city, niche){
  if(!PLACES_KEY) return null;
  const q=encodeURIComponent(company+(city?' '+city:''));
  const find=await withTimeout(s=>getJSON(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=place_id,name&key=${PLACES_KEY}`,s),6000);
  const cand=find&&find.candidates&&find.candidates[0];
  if(!cand) return null;
  const pid=cand.place_id;
  const det=await withTimeout(s=>getJSON(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${pid}&fields=name,rating,user_ratings_total,business_status,photos,reviews&key=${PLACES_KEY}`,s),6000);
  const r=(det&&det.result)||{};
  let rank=null, compReviews=null;
  try{
    const tq=encodeURIComponent((niche||'cabinet refacing')+' in '+(city||''));
    const ts=await withTimeout(s=>getJSON(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${tq}&key=${PLACES_KEY}`,s),6000);
    const list=(ts&&ts.results)||[];
    const idx=list.findIndex(x=>x.place_id===pid);
    if(idx>=0) rank=idx+1;
    const others=list.filter(x=>x.place_id!==pid && typeof x.user_ratings_total==='number');
    if(others.length) compReviews=Math.max(...others.map(x=>x.user_ratings_total));
  }catch(e){}
  let recency=null;
  if(Array.isArray(r.reviews)&&r.reviews.length){
    const newest=Math.max(...r.reviews.map(rv=>rv.time||0));
    if(newest) recency=Math.max(1,Math.round((Date.now()/1000-newest)/604800));
  }
  const gmb={};
  if(r.business_status) gmb.claimed = r.business_status==='OPERATIONAL';
  if(r.rating!=null) gmb.rating=r.rating;
  if(r.user_ratings_total!=null) gmb.reviews=r.user_ratings_total;
  if(rank!=null) gmb.rank=rank;
  if(compReviews!=null) gmb.compReviews=compReviews;
  if(Array.isArray(r.photos)) gmb.photos=r.photos.length;
  const reviews={};
  if(r.rating!=null) reviews.rating=r.rating;
  if(r.user_ratings_total!=null) reviews.reviews=r.user_ratings_total;
  if(recency!=null) reviews.recency=recency;
  const out={};
  if(Object.keys(gmb).length) out.gmb=gmb;
  if(reviews.rating!=null) out.reviews=reviews;
  return Object.keys(out).length?out:null;
}

async function fetchCensus(cityObj){
  if(!cityObj || !CENSUS_KEY) return null;
  const vars='NAME,B01003_001E,B25077_001E,B19013_001E,B11001_001E';
  const url=`https://api.census.gov/data/2022/acs/acs5?get=${vars}&for=place:*&in=state:${cityObj.fips}&key=${CENSUS_KEY}`;
  const rows=await withTimeout(s=>getJSON(url,s),7000);
  if(!Array.isArray(rows)||rows.length<2) return null;
  const h=rows[0], iName=h.indexOf('NAME'), target=cityObj.name.toLowerCase();
  let best=null;
  for(let i=1;i<rows.length;i++){ const nm=(rows[i][iName]||'').toLowerCase(); if(nm.startsWith(target+' city')||nm.startsWith(target+' town')||nm.startsWith(target+',')){ best=rows[i]; break; } }
  if(!best){ for(let i=1;i<rows.length;i++){ if((rows[i][iName]||'').toLowerCase().includes(target)){ best=rows[i]; break; } } }
  if(!best) return null;
  const num=(v)=>{ const n=parseInt(v,10); return isNaN(n)||n<0?null:n; };
  const m={};
  const pop=num(best[h.indexOf('B01003_001E')]); if(pop) m.population=pop;
  const mh=num(best[h.indexOf('B25077_001E')]); if(mh) m.medianHome=mh;
  const inc=num(best[h.indexOf('B19013_001E')]); if(inc) m.medianIncome=inc;
  const hh=num(best[h.indexOf('B11001_001E')]); if(hh) m.households=hh;
  return Object.keys(m).length?m:null;
}

exports.handler = async (event) => {
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(event.httpMethod==='OPTIONS') return {statusCode:204,headers,body:''};
  let b={}; try{ b=JSON.parse(event.body||'{}'); }catch(e){}
  const company=(b.company||'').trim(), city=(b.city||'').trim(), niche=(b.niche||'cabinet refacing').trim();
  if(!company) return {statusCode:400,headers,body:JSON.stringify({ok:false,error:'company required'})};

  const sources={places:false,census:false};
  const out={ok:true};
  const [p,c]=await Promise.allSettled([
    fetchPlaces(company,city,niche).catch(()=>null),
    fetchCensus(parseCity(city)).catch(()=>null)
  ]);
  if(p.status==='fulfilled'&&p.value){ if(p.value.gmb) out.gmb=p.value.gmb; if(p.value.reviews) out.reviews=p.value.reviews; sources.places=true; }
  if(c.status==='fulfilled'&&c.value){ out.market=c.value; sources.census=true; }
  out.sources=sources;
  return {statusCode:200,headers,body:JSON.stringify(out)};
};
