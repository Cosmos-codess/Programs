/* NARC-ID V2 — integrated field workflow */
const SUPABASE_URL='https://dazxbtsexxojhvldvedt.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_H_9A1TNzhN748HfOoZfuCg_RSHLLkpu';
const sb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id); const q=s=>document.querySelector(s); const qa=s=>[...document.querySelectorAll(s)];
let currentUser=null, subjectStream=null, testStream=null, gps=null, subjectPhoto=null, capturedImage=null, pendingRecord=null, liveTimer=null, records=[];
const views=['dashboard','subject','newTest','capture','analysis','review','records','detail','verify'];
function toast(m){const e=$('toast');e.textContent=m;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2600)}
function showView(name){views.forEach(v=>$(`${v}View`)?.classList.remove('active'));$(`${name}View`)?.classList.add('active');qa('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));window.scrollTo({top:0,behavior:'smooth'});if(name==='subject')startSubjectCamera();if(name!=='subject')stopSubjectCamera();if(name!=='capture')stopTestCamera();if(name==='dashboard')loadDashboard();if(name==='records')renderRecords()}
function bytesHex(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function hexBuf(h){const a=new Uint8Array(h.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(h.slice(i*2,i*2+2),16);return a.buffer}
function salt(){return bytesHex(crypto.getRandomValues(new Uint8Array(16)).buffer)}
async function hashPassword(p,s){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);return bytesHex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:hexBuf(s),iterations:100000,hash:'SHA-256'},k,256))}
async function sha256Text(t){return bytesHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))}
async function sha256DataUrl(url){const b=await (await fetch(url)).arrayBuffer();return bytesHex(await crypto.subtle.digest('SHA-256',b))}
function normalizeBadge(v){return v.trim().toUpperCase()}
async function getOfficer(badge){if(!sb)return null;const {data,error}=await sb.from('officers').select('*').eq('badge_number',badge).maybeSingle();if(error)throw error;return data}
function stopSubjectCamera(){if(subjectStream){subjectStream.getTracks().forEach(t=>t.stop());subjectStream=null}}
function stopTestCamera(){if(testStream){testStream.getTracks().forEach(t=>t.stop());testStream=null}if(liveTimer){cancelAnimationFrame(liveTimer);liveTimer=null}}
function stopAll(){stopSubjectCamera();stopTestCamera()}
async function startSubjectCamera(){if(subjectStream||subjectPhoto)return;try{subjectStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:720}},audio:false});$('subjectVideo').srcObject=subjectStream;$('subjectCameraMessage').textContent='Front camera ready. Centre the subject and capture.'}catch(e){$('subjectCameraMessage').textContent='Camera unavailable. You can still continue after documenting the reason.'}}
$('captureSubjectButton').onclick=()=>{const v=$('subjectVideo');if(!v.videoWidth){toast('Camera is not ready');return}const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);subjectPhoto=c.toDataURL('image/jpeg',.86);$('subjectSnapshot').src=subjectPhoto;$('subjectSnapshot').style.display='block';v.style.display='none';$('captureSubjectButton').hidden=true;$('retakeSubjectButton').hidden=false;toast('Subject photo captured')}
$('retakeSubjectButton').onclick=()=>{subjectPhoto=null;$('subjectSnapshot').style.display='none';$('subjectVideo').style.display='block';$('captureSubjectButton').hidden=false;$('retakeSubjectButton').hidden=true}
$('continueSubjectButton').onclick=()=>{const name=$('subjectName').value.trim();const drug=$('subjectDrug').value.trim();const qty=$('subjectQuantity').value.trim();if(!name||!drug||!qty){$('subjectError').textContent='Enter subject name, suspected drug and quantity.';return}if(!subjectPhoto){$('subjectError').textContent='Capture the subject photograph before continuing.';return}$('subjectError').textContent='';showView('newTest');getGPS()}
async function getGPS(){if(!navigator.geolocation){gps=null;updateGPS();return}navigator.geolocation.getCurrentPosition(p=>{gps={lat:+p.coords.latitude.toFixed(6),lon:+p.coords.longitude.toFixed(6),accuracy:+p.coords.accuracy.toFixed(1)};updateGPS()},()=>{gps=null;updateGPS()},{enableHighAccuracy:true,timeout:10000,maximumAge:0})}
function updateGPS(){$('locationCheck').textContent=gps?'✓':'○';$('locationText').textContent=gps?`${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} (±${Math.round(gps.accuracy)} m)`:'GPS unavailable — continue only if appropriate';$('liveGps').textContent=gps?`GPS: ${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}`:'GPS: unavailable'}
async function startTestCamera(){stopTestCamera();try{testStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});$('testVideo').srcObject=testStream;$('cameraCheck').textContent='✓';runLiveChecks()}catch(e){$('cameraCheck').textContent='!';toast('Rear camera unavailable: '+e.message)}}
function runLiveChecks(){const v=$('testVideo'),c=$('captureCanvas');const tick=()=>{if(!testStream)return;if(v.videoWidth){c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(v,0,0,c.width,c.height);const s=sampleRegion(ctx,.08,.72,.34,.20,c.width,c.height);$('liveLight').textContent=s.avgLum>70&&s.avgLum<235?'Lighting: OK':'Lighting: adjust';$('liveFocus').textContent=s.contrast>25?'Focus: OK':'Focus: hold steady'}liveTimer=requestAnimationFrame(tick)};tick()}
function sampleRegion(ctx,xF,yF,wF,hF,W,H){const x=Math.max(0,Math.floor(xF*W)),y=Math.max(0,Math.floor(yF*H)),w=Math.max(1,Math.min(W-x,Math.floor(wF*W))),h=Math.max(1,Math.min(H-y,Math.floor(hF*H)));const d=ctx.getImageData(x,y,w,h).data;let r=0,g=0,b=0,n=0,minL=255,maxL=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++;const l=.299*d[i]+.587*d[i+1]+.114*d[i+2];minL=Math.min(minL,l);maxL=Math.max(maxL,l)}return{r:r/n,g:g/n,b:b/n,avgLum:(r+g+b)/(3*n),contrast:maxL-minL}}
function ninePoint(ctx,zone,W,H){const pts=[];const xs=[.18,.5,.82],ys=[.18,.5,.82];for(const yf of ys)for(const xf of xs){const cx=zone.x+zone.w*xf,cy=zone.y+zone.h*yf;pts.push(sampleRegion(ctx,cx-zone.sw/2,cy-zone.sh/2,zone.sw,zone.sh,W,H))}const avg=pts.reduce((a,p)=>({r:a.r+p.r,g:a.g+p.g,b:a.b+p.b}),{r:0,g:0,b:0});avg.r/=9;avg.g/=9;avg.b/=9;const distances=pts.map(p=>Math.sqrt((p.r-avg.r)**2+(p.g-avg.g)**2+(p.b-avg.b)**2));const meanDist=distances.reduce((a,b)=>a+b,0)/9;const consistency=Math.max(0,Math.min(100,100-meanDist*1.65));return{points:pts,avg,meanDist,consistency,valid:consistency>=78}}
function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=60*(((g-b)/d)%6);else if(mx===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);if(h<0)h+=360}return{h,s:mx?d/mx:0,v:mx}}
const POS_HUES={Marquis:280,Mecke:170,"Simon's":210,Scott:210,Other:280};
function colourDistance(a,b){return Math.sqrt((a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2)}
function classify(ref,test,reagent){const hsv=rgbToHsv(test.avg.r,test.avg.g,test.avg.b);const target=POS_HUES[reagent]??280;const hd=Math.abs(hsv.h-target);const hueDist=hd>180?360-hd:hd;const refLum=Math.max(1,(ref.avg.r+ref.avg.g+ref.avg.b)/3);const scale=200/refLum;const corrected={r:Math.min(255,test.avg.r*scale),g:Math.min(255,test.avg.g*scale),b:Math.min(255,test.avg.b*scale)};const ch=rgbToHsv(corrected.r,corrected.g,corrected.b);const sat=ch.s;let category='INCONCLUSIVE',reason='';if(!ref.valid||!test.valid)reason='Colour variation across the sampled area is too high.';else if(sat<.15){category='NEGATIVE';reason='No sufficiently saturated colour response detected under the configured prototype criteria.'}else if(hueDist<=40){category='POSITIVE';reason='Colour response is within the configured prototype positive hue range.'}else if(hueDist>=75){category='NEGATIVE';reason='Colour response is outside the configured prototype positive range.'}else{reason='Colour response falls between configured decision ranges.'}const confidence=category==='INCONCLUSIVE'?Math.round(Math.min(ref.consistency,test.consistency)):Math.round(Math.max(0,Math.min(100,100-hueDist*.55+(Math.min(ref.consistency,test.consistency)-78)*.35)));return{category,confidence,hue:ch.h,hueDistance:hueDist,corrected,reason}}
function capture(){const v=$('testVideo'),c=$('captureCanvas');if(!v.videoWidth){toast('Camera is not ready');return}c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(v,0,0,c.width,c.height);capturedImage=c.toDataURL('image/jpeg',.9);stopTestCamera();runAnalysis(c)}
$('captureButton').onclick=capture;
function runAnalysis(c){showView('analysis');$('analysisContent').innerHTML='<div class="eyebrow">ANALYSIS</div><h2>Running quality and 9-point checks…</h2><p class="lead">The image is being measured before a classification is shown.</p>';setTimeout(()=>{const ctx=c.getContext('2d',{willReadFrequently:true});const W=c.width,H=c.height;const ref=ninePoint(ctx,{x:.08,y:.72,w:.34,h:.20,sw:.035,sh:.035},W,H);const test=ninePoint(ctx,{x:.22,y:.14,w:.56,h:.28,sw:.035,sh:.035},W,H);const whole=sampleRegion(ctx,0,0,1,1,W,H);const quality={brightness:whole.avgLum,glare:glare(ctx),sharpness:sharpness(c),brightnessPass:whole.avgLum>=45&&whole.avgLum<=215,glarePass:glare(ctx)<8,refPass:ref.valid,testPass:test.valid};const reagent=$('testType').value;const classification=classify(ref,test,reagent);const qualityPassed=quality.brightnessPass&&quality.glarePass&&quality.sharpness>=35&&ref.valid&&test.valid;pendingRecord={analysis:{ref,test,quality,classification,reagent}};renderAnalysis(pendingRecord.analysis,qualityPassed)},350)}
function glare(ctx){const W=ctx.canvas.width,H=ctx.canvas.height,d=ctx.getImageData(0,0,W,H).data;let n=0,b=0;for(let i=0;i<d.length;i+=16){if(d[i]>248&&d[i+1]>248&&d[i+2]>248)b++;n++}return n?b/n*100:0}
function sharpness(c){const ctx=c.getContext('2d',{willReadFrequently:true}),W=Math.min(c.width,500),H=Math.min(c.height,500);const tmp=document.createElement('canvas');tmp.width=W;tmp.height=H;const x=tmp.getContext('2d',{willReadFrequently:true});x.drawImage(c,0,0,W,H);const d=x.getImageData(0,0,W,H).data;let sum=0,sq=0,n=0;for(let y=1;y<H-1;y+=2)for(let xx=1;xx<W-1;xx+=2){const p=(y*W+xx)*4,l=(.299*d[p]+.587*d[p+1]+.114*d[p+2]),up=(.299*d[p-4*W]+.587*d[p-4*W+1]+.114*d[p-4*W+2]),dn=(.299*d[p+4*W]+.587*d[p+4*W+1]+.114*d[p+4*W+2]),le=(.299*d[p-4]+.587*d[p-3]+.114*d[p-2]),ri=(.299*d[p+4]+.587*d[p+5]+.114*d[p+6]),lap=Math.abs(up+dn+le+ri-4*l);sum+=lap;sq+=lap*lap;n++}return n?Math.max(0,(sq/n)-(sum/n)**2):0}
function renderAnalysis(a,qualityPassed){const q=a.quality,r=a.ref,t=a.test,c=a.classification;const finalCategory=qualityPassed?c.category:'INCONCLUSIVE';const finalReason=qualityPassed?c.reason:'Image quality did not meet all critical checks, so classification is inconclusive.';a.classification.category=finalCategory;a.classification.reason=finalReason;const cls=finalCategory.toLowerCase();$('analysisContent').innerHTML=`<div class="result-banner ${cls}"><div class="eyebrow">FIELD SCREENING RESULT</div><h3>${finalCategory==='POSITIVE'?'PRESUMPTIVE POSITIVE':finalCategory==='NEGATIVE'?'PRESUMPTIVE NEGATIVE':'INCONCLUSIVE'}</h3><p>${finalReason}</p></div><div class="analysis-grid"><div class="metric"><span>Brightness</span><strong>${q.brightness.toFixed(0)} ${q.brightnessPass?'✓':'⚠'}</strong></div><div class="metric"><span>Glare</span><strong>${q.glare.toFixed(1)}% ${q.glarePass?'✓':'⚠'}</strong></div><div class="metric"><span>Sharpness</span><strong>${q.sharpness.toFixed(0)} ${q.sharpness>=35?'✓':'⚠'}</strong></div><div class="metric"><span>Reference consistency</span><strong>${r.consistency.toFixed(0)}%</strong></div><div class="metric"><span>Test consistency</span><strong>${t.consistency.toFixed(0)}%</strong></div><div class="metric"><span>Colour distance</span><strong>${c.hueDistance.toFixed(1)}°</strong></div></div><div class="consistency-grid"><div class="metric"><span>Reference 3×3 sampling</span><div class="grid9">${r.points.map(()=>'<span></span>').join('')}</div></div><div class="metric"><span>Test 3×3 sampling</span><div class="grid9">${t.points.map(()=>'<span></span>').join('')}</div></div></div><p class="muted">Configured prototype threshold: 78% minimum 9-point consistency. Colour profiles are configurable and are not manufacturer-validated.</p><button class="primary-button large" id="continueToReview">Continue to result review →</button><button class="secondary-button large" id="retakeFromAnalysis">Retake image</button>`;$('continueToReview').onclick=()=>buildReview(a);$('retakeFromAnalysis').onclick=()=>{capturedImage=null;showView('capture');startTestCamera()}}
async function buildReview(a){showView('review');const timestamp=new Date().toISOString();const imageHash=await sha256DataUrl(capturedImage);const testId='NARC-TEST-'+Date.now().toString(36).toUpperCase();const sealPayload={testId,operatorId:currentUser.badgeNumber,result:a.classification.category,timestamp,gps,subject:$('subjectName').value.trim(),drug:$('subjectDrug').value.trim(),quantity:$('subjectQuantity').value.trim(),reagent:a.reagent,imageHash,refAvg:a.ref.avg,testAvg:a.test.avg,refConsistency:a.ref.consistency,testConsistency:a.test.consistency,analysisVersion:'V2.9POINT.1'};const sealHash=await sha256Text(JSON.stringify(sealPayload));pendingRecord={...sealPayload,subjectPhotoDataUrl:subjectPhoto,testImageDataUrl:capturedImage,confidence:a.classification.confidence,reason:a.classification.reason,classificationProfile:'Prototype reagent profile',sealHash};renderReview()}
function renderReview(){$('reviewResult').innerHTML=`<div class="result-banner ${pendingRecord.result.toLowerCase()}"><div class="eyebrow">RESULT READY</div><h3>${pendingRecord.result==='POSITIVE'?'PRESUMPTIVE POSITIVE':pendingRecord.result==='NEGATIVE'?'PRESUMPTIVE NEGATIVE':'INCONCLUSIVE'}</h3><p>${pendingRecord.reason}</p></div>`;$('reviewImage').src=pendingRecord.testImageDataUrl;$('reviewDetails').innerHTML=[['Test ID',pendingRecord.testId],['Officer',pendingRecord.operatorId],['Reagent',pendingRecord.reagent],['Subject',pendingRecord.subject],['Drug',pendingRecord.drug],['Quantity',pendingRecord.quantity],['Confidence',pendingRecord.confidence+'%'],['Location',gps?`${gps.lat}, ${gps.lon}`:'Unavailable'],['Reference consistency',pendingRecord.refConsistency.toFixed(1)+'%'],['Test consistency',pendingRecord.testConsistency.toFixed(1)+'%'],['Image SHA-256',pendingRecord.imageHash],['Seal',pendingRecord.sealHash]].map(x=>`<div class="metric"><span>${x[0]}</span><strong>${x[1]||'—'}</strong></div>`).join('')}
async function saveRecord(){
  if(!pendingRecord)return;

  const btn=$('saveButton');
  btn.disabled=true;
  btn.textContent='Sealing…';

  try{
    const r=pendingRecord;

    const row={
      test_id:r.testId,
      timestamp:r.timestamp,

      officer_id:r.operatorId||null,
      officer_name:currentUser?.name||null,

      subject_name:r.subject||null,
      aadhaar_number:$('subjectAadhaar').value.trim()||null,

      drug:r.drug||null,
      quantity:r.quantity||null,
      reagent:r.reagent||null,

      latitude:r.gps?.lat??null,
      longitude:r.gps?.lon??null,
      location:r.gps
        ? `${r.gps.lat}, ${r.gps.lon}`
        : null,

      result:r.result||null,
      confidence:r.confidence??null,

      subject_photo:r.subjectPhotoDataUrl||null,
      test_image:r.testImageDataUrl||null,

      reference_colour:r.refAvg
        ? JSON.stringify(r.refAvg)
        : null,

      test_colour:r.testAvg
        ? JSON.stringify(r.testAvg)
        : null,

      colour_difference:r.colourDifference??null,

      consistency_score:Math.min(
        r.refConsistency??0,
        r.testConsistency??0
      ),

      image_hash:r.imageHash||null,
      sealed_hash:r.sealHash||null,

      disclaimer:
        'Field-screening result only. Not laboratory confirmation.'
    };

    if(!sb){
      throw new Error('Supabase is not connected.');
    }

    const {error}=await sb
      .from('narc_tests')
      .insert(row);

    if(error)throw error;

    // Keep a local copy as well
    const local=JSON.parse(
      localStorage.getItem('narcLocalRecords')||'[]'
    );

    local.unshift(r);

    localStorage.setItem(
      'narcLocalRecords',
      JSON.stringify(local)
    );

    toast('Record sealed and saved to Supabase');

    pendingRecord=null;
    resetTest();
    showView('records');

  }catch(e){

    console.error(e);
    toast('Save failed: '+e.message);

  }finally{

    btn.disabled=false;
    btn.innerHTML='Seal & save record <span>→</span>';

  }
}
function resetTest(){stopAll();subjectPhoto=null;capturedImage=null;gps=null;['subjectName','subjectAadhaar','subjectDrug','subjectQuantity'].forEach(id=>$(id).value='');$('subjectSnapshot').style.display='none';$('subjectVideo').style.display='block';$('captureSubjectButton').hidden=false;$('retakeSubjectButton').hidden=true}
async function loadRecords(){let remote=[];if(sb){try{const {data,error}=await sb.from('tests').select('id,ts,operator_id,test_type,result,confidence,gps_lat,gps_lon,gps_accuracy,suspect_name,aadhaar_number,suspected_drug,quantity_seized,suspect_photo_data_url,test_image_data_url,image_hash_ciphertext,image_hash_iv').order('ts',{ascending:false});if(!error)remote=(data||[]).map(rowToRecord)}catch(e){console.warn(e)}}const local=JSON.parse(localStorage.getItem('narcLocalRecords')||'[]');const map=new Map();[...local,...remote].forEach(r=>map.set(r.testId,r));return [...map.values()].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))}
function rowToRecord(r){return{testId:r.id,timestamp:r.ts,operatorId:r.operator_id,result:r.result,confidence:r.confidence,gps:r.gps_lat!=null?{lat:r.gps_lat,lon:r.gps_lon,accuracy:r.gps_accuracy}:null,subject:r.suspect_name,aadhaarNumber:r.aadhaar_number,drug:r.suspected_drug,quantity:r.quantity_seized,reagent:r.test_type,subjectPhotoDataUrl:r.suspect_photo_data_url,testImageDataUrl:r.test_image_data_url,sealHash:r.image_hash_ciphertext,hashIv:r.image_hash_iv||'plain-seal-v1',refConsistency:null,testConsistency:null}}
function withinDays(r,d){return Date.now()-new Date(r.timestamp).getTime()<=d*86400000}
async function loadDashboard(){records=await loadRecords();const today=new Date().toDateString();const todayN=records.filter(r=>new Date(r.timestamp).toDateString()===today).length;const week=records.filter(r=>withinDays(r,7)),month=records.filter(r=>withinDays(r,30));$('statToday').textContent=todayN;$('statWeek').textContent=week.length;$('statMonth').textContent=month.length;$('statQuantity').textContent=week.reduce((a,r)=>a+(parseFloat(String(r.quantity||'').replace(/[^0-9.]/g,''))||0),0).toFixed(2)+' g';$('countPositive').textContent=week.filter(r=>r.result==='POSITIVE').length;$('countNegative').textContent=week.filter(r=>r.result==='NEGATIVE').length;$('countInconclusive').textContent=week.filter(r=>r.result==='INCONCLUSIVE').length;drawChart(week,$('chartMetric').value);renderDashboardTable(week)}
function drawChart(rs,metric){const days=[];for(let i=6;i>=0;i--){const d=new Date(Date.now()-i*86400000);days.push({label:d.toLocaleDateString(undefined,{weekday:'short'}),date:d.toDateString(),v:0})}rs.forEach(r=>{const d=days.find(x=>x.date===new Date(r.timestamp).toDateString());if(d)d.v++});if(metric!=='tests')days.forEach(d=>{d.v=rs.filter(r=>new Date(r.timestamp).toDateString()===d.date&&r.result===metric.toUpperCase()).length});const max=Math.max(1,...days.map(d=>d.v));$('trendChart').innerHTML=days.map(d=>`<div class="bar-col"><span class="bar-value">${d.v}</span><div class="bar" style="height:${Math.max(3,d.v/max*78)}%"></div><span class="bar-label">${d.label}</span></div>`).join('')}
function locationText(r){return r.gps?`${r.gps.lat.toFixed(4)}, ${r.gps.lon.toFixed(4)}`:'—'}
function pill(r){const c=r.result==='POSITIVE'?'positive':r.result==='NEGATIVE'?'negative':'inconclusive';return `<span class="result-pill ${c}">${r.result==='POSITIVE'?'PRESUMPTIVE POSITIVE':r.result==='NEGATIVE'?'PRESUMPTIVE NEGATIVE':'INCONCLUSIVE'}</span>`}
function renderDashboardTable(rs){$('dashboardTable').innerHTML=rs.slice(0,8).map(r=>`<tr><td>${new Date(r.timestamp).toLocaleDateString()}</td><td>${escapeHtml(r.drug||'—')}</td><td>${escapeHtml(r.quantity||'—')}</td><td>${locationText(r)}</td><td>${pill(r)}</td><td>${escapeHtml(r.operatorId||'—')}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">No records in the last 7 days.</td></tr>'}
function renderRecords(){const search=($('recordSearch')?.value||'').toLowerCase();const op=$('recordOperatorFilter')?.value||'';let rs=records.filter(r=>(!op||r.operatorId===op)&&(!search||[r.subject,r.drug,r.result,r.operatorId,r.testId].some(x=>String(x||'').toLowerCase().includes(search))));$('recordList').innerHTML=rs.map(r=>`<article class="record-card" data-id="${r.testId}"><div class="record-head"><div><div class="eyebrow">${new Date(r.timestamp).toLocaleString()}</div><strong>${escapeHtml(r.testId)}</strong></div>${pill(r)}</div><div class="record-meta"><div><span>Subject</span><strong>${escapeHtml(r.subject||'—')}</strong></div><div><span>Drug</span><strong>${escapeHtml(r.drug||'—')}</strong></div><div><span>Quantity</span><strong>${escapeHtml(r.quantity||'—')}</strong></div><div><span>Location</span><strong>${locationText(r)}</strong></div></div></article>`).join('')||'<p class="muted">No matching records.</p>';qa('.record-card').forEach(e=>e.onclick=()=>openDetail(e.dataset.id))}
function openDetail(id){const r=records.find(x=>x.testId===id);if(!r)return;$('detailTitle').textContent=r.testId;$('detailResult').innerHTML=`<div class="result-banner ${r.result.toLowerCase()}"><h3>${r.result==='POSITIVE'?'PRESUMPTIVE POSITIVE':r.result==='NEGATIVE'?'PRESUMPTIVE NEGATIVE':'INCONCLUSIVE'}</h3><p>This is a field-screening record, not laboratory confirmation.</p></div>`;$('detailSubjectImage').src=r.subjectPhotoDataUrl||'';$('detailSubjectImage').style.display=r.subjectPhotoDataUrl?'block':'none';$('detailTestImage').src=r.testImageDataUrl||'';$('detailFields').innerHTML=[['Subject',r.subject],['Aadhaar / ID',r.aadhaarNumber],['Drug',r.drug],['Quantity',r.quantity],['Reagent',r.reagent],['Officer',r.operatorId],['Timestamp',r.timestamp],['GPS',locationText(r)],['Confidence',r.confidence+'%'],['Seal',r.sealHash]].map(x=>`<div class="metric"><span>${x[0]}</span><strong>${escapeHtml(String(x[1]??'—'))}</strong></div>`).join('');$('detailVerifyResult').textContent='';$('detailVerifyButton').onclick=()=>verifyObject(r,$('detailVerifyResult'));showView('detail')}
async function verifyObject(r,box){box.textContent='Verifying…';try{let ok=false;if(r.hashIv==='plain-seal-v1'||r.hashIv===''){const payload={testId:r.testId,operatorId:r.operatorId,result:r.result,timestamp:r.timestamp,gps:r.gps,subject:r.subject,drug:r.drug,quantity:r.quantity,reagent:r.reagent,imageHash:r.imageHash,refAvg:r.refAvg,testAvg:r.testAvg,refConsistency:r.refConsistency,testConsistency:r.testConsistency,analysisVersion:r.analysisVersion};if(r.sealHash&&r.imageHash)ok=(await sha256Text(JSON.stringify(payload)))===r.sealHash;else ok=!!r.sealHash}else{ok=false}box.className='verification-box '+(ok?'ok':'bad');box.innerHTML=ok?'✓ INTEGRITY VERIFIED — sealed record matches its stored integrity data.':'⚠ Verification unavailable or mismatch. The record should be reviewed.'}catch(e){box.className='verification-box bad';box.textContent='Verification failed: '+e.message}}
$('verifyRecordButton').onclick=async()=>{const id=$('verifyRecordId').value.trim();const box=$('verificationResult');const r=records.find(x=>x.testId===id);if(!r){box.className='verification-box bad';box.textContent='Record not found.';return}await verifyObject(r,box)};
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
$('loginForm').onsubmit=async e=>{e.preventDefault();const err=$('loginError');err.textContent='';const badge=normalizeBadge($('loginBadge').value),pw=$('loginPassword').value;if(!badge||!pw)return;try{const u=await getOfficer(badge);if(!u){err.textContent='No account found for that badge number.';return}const h=await hashPassword(pw,u.salt);if(h!==u.password_hash){err.textContent='Incorrect password.';return}currentUser={badgeNumber:u.badge_number,role:u.role,name:u.name||u.badge_number};sessionStorage.setItem('narcUser',JSON.stringify(currentUser));onLogin()}catch(e){err.textContent='Sign-in failed: '+e.message}}
$('registerForm').onsubmit=async e=>{e.preventDefault();const err=$('regError');err.textContent='';const badge=normalizeBadge($('regBadge').value),role=q('input[name="regRole"]:checked').value,pw=$('regPassword').value,pw2=$('regPassword2').value;if(!badge||pw.length<8||pw!==pw2){err.textContent=pw.length<8?'Password must be at least 8 characters.':'Passwords do not match or badge is empty.';return}try{if(await getOfficer(badge)){err.textContent='An account with this badge already exists.';return}const s=salt(),h=await hashPassword(pw,s);const {error}=await sb.from('officers').insert({badge_number:badge,role,salt:s,password_hash:h});if(error)throw error;$('loginBadge').value=badge;showAuth('login');toast('Officer account created')}catch(e){err.textContent='Registration failed: '+e.message}}
function showAuth(n){$('loginScreen').classList.toggle('active',n==='login');$('registerScreen').classList.toggle('active',n==='register')}
$('goRegister').onclick=()=>showAuth('register');$('backToLogin').onclick=()=>showAuth('login');$('logoutButton').onclick=()=>{sessionStorage.removeItem('narcUser');currentUser=null;stopAll();$('appScreen').classList.remove('active');showAuth('login')};
function onLogin(){showAuth('none');$('loginScreen').classList.remove('active');$('registerScreen').classList.remove('active');$('appScreen').classList.add('active');$('sessionName').textContent=currentUser.name;$('sessionRole').textContent=currentUser.role==='supervisor'?'SUPERVISOR':'FIELD OFFICER';$('avatar').textContent=currentUser.badgeNumber.slice(0,2);$('preparationOperator').textContent=`${currentUser.name} • ${currentUser.badgeNumber}`;loadDashboard()}
$('startTestButton').onclick=()=>showView('subject');$('openRecordsButton').onclick=()=>showView('records');$('verifyButton').onclick=()=>showView('verify');$('beginCaptureButton').onclick=()=>{showView('capture');startTestCamera();getGPS()};$('captureBackButton').onclick=()=>showView('newTest');$('analysisBackButton').onclick=()=>showView('capture');$('reviewBackButton').onclick=()=>showView('analysis');$('discardButton').onclick=()=>{pendingRecord=null;resetTest();showView('dashboard')};$('saveButton').onclick=saveRecord;$('detailBackButton').onclick=()=>showView('records');$('chartMetric').onchange=()=>drawChart(records.filter(r=>withinDays(r,7)),$('chartMetric').value);$('recordSearch').oninput=renderRecords;$('recordOperatorFilter').onchange=renderRecords;qa('[data-back]').forEach(b=>b.onclick=()=>{stopAll();showView('dashboard')});qa('.nav-item').forEach(b=>b.onclick=()=>showView(b.dataset.nav));
(async()=>{const saved=sessionStorage.getItem('narcUser');if(saved){try{currentUser=JSON.parse(saved);onLogin()}catch{}}})();
