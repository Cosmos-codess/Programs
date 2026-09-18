/* NARC-ID — integrated field workflow */

const SUPABASE_URL='https://dazxbtsexxojhvldvedt.supabase.co';

/*
  KEEP YOUR EXISTING SUPABASE PUBLISHABLE KEY HERE.
  Do NOT put a service-role key in frontend JavaScript.
*/
const SUPABASE_ANON_KEY='sb_publishable_H_9A1TNzhN748HfOoZfuCg_RSHLLkpu';

const sb=window.supabase?.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $=id=>document.getElementById(id);
const q=s=>document.querySelector(s);
const qa=s=>[...document.querySelectorAll(s)];

let currentUser=null;
let subjectStream=null;
let testStream=null;
let gps=null;
let subjectPhoto=null;
let capturedImage=null;
let pendingRecord=null;
let liveTimer=null;
let records=[];
let selectedActivityDate=null;

const views=[
  'dashboard',
  'subject',
  'newTest',
  'capture',
  'analysis',
  'review',
  'records',
  'detail',
  'verify'
];

function toast(m){
  const e=$('toast');
  e.textContent=m;
  e.classList.add('show');
  clearTimeout(toast.t);
  toast.t=setTimeout(
    ()=>e.classList.remove('show'),
    2600
  );
}

function showView(name){
  views.forEach(v=>
    $(`${v}View`)?.classList.remove('active')
  );

  $(`${name}View`)?.classList.add('active');

  qa('.nav-item').forEach(n=>
    n.classList.toggle(
      'active',
      n.dataset.nav===name
    )
  );

  window.scrollTo({
    top:0,
    behavior:'smooth'
  });

  if(name==='subject')startSubjectCamera();
  if(name!=='subject')stopSubjectCamera();

  if(name!=='capture')stopTestCamera();

  if(name==='dashboard')loadDashboard();

  if(name==='records')renderRecords();
}


/* =========================================================
   HASHING / PASSWORD
   ========================================================= */

function bytesHex(buf){
  return [...new Uint8Array(buf)]
    .map(b=>b.toString(16).padStart(2,'0'))
    .join('');
}

function hexBuf(h){
  const a=new Uint8Array(h.length/2);

  for(let i=0;i<a.length;i++){
    a[i]=parseInt(
      h.slice(i*2,i*2+2),
      16
    );
  }

  return a.buffer;
}

function salt(){
  return bytesHex(
    crypto.getRandomValues(
      new Uint8Array(16)
    ).buffer
  );
}

async function hashPassword(p,s){
  const k=await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(p),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return bytesHex(
    await crypto.subtle.deriveBits(
      {
        name:'PBKDF2',
        salt:hexBuf(s),
        iterations:100000,
        hash:'SHA-256'
      },
      k,
      256
    )
  );
}

/*
  Stores:
  salt$hash

  This means we do NOT need a separate salt column
  in narc_officers.
*/
async function createPasswordHash(password){
  const s=salt();
  const h=await hashPassword(password,s);
  return `${s}$${h}`;
}

async function verifyPassword(password,stored){
  if(!stored)return false;

  const parts=stored.split('$');

  if(parts.length!==2)return false;

  const s=parts[0];
  const expected=parts[1];

  const actual=await hashPassword(
    password,
    s
  );

  return actual===expected;
}

async function sha256Text(t){
  return bytesHex(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(t)
    )
  );
}

async function sha256DataUrl(url){
  const b=await(
    await fetch(url)
  ).arrayBuffer();

  return bytesHex(
    await crypto.subtle.digest(
      'SHA-256',
      b
    )
  );
}

function normalizeBadge(v){
  return v.trim().toUpperCase();
}


/* =========================================================
   SUPABASE OFFICERS
   ========================================================= */

async function getOfficer(badge){

  if(!sb)return null;

  const {
    data,
    error
  }=await sb
    .from('narc_officers')
    .select('*')
    .eq('officer_id',badge)
    .maybeSingle();

  if(error)throw error;

  return data;
}


/* =========================================================
   CAMERAS
   ========================================================= */

function stopSubjectCamera(){

  if(subjectStream){

    subjectStream
      .getTracks()
      .forEach(t=>t.stop());

    subjectStream=null;
  }
}

function stopTestCamera(){

  if(testStream){

    testStream
      .getTracks()
      .forEach(t=>t.stop());

    testStream=null;
  }

  if(liveTimer){

    cancelAnimationFrame(liveTimer);

    liveTimer=null;
  }
}

function stopAll(){
  stopSubjectCamera();
  stopTestCamera();
}

async function startSubjectCamera(){

  if(subjectStream||subjectPhoto)return;

  try{

    subjectStream=
      await navigator.mediaDevices.getUserMedia({
        video:{
          facingMode:{
            ideal:'user'
          },
          width:{
            ideal:1280
          },
          height:{
            ideal:720
          }
        },
        audio:false
      });

    $('subjectVideo').srcObject=
      subjectStream;

    $('subjectCameraMessage').textContent=
      'Front camera ready. Centre the subject and capture.';

  }catch(e){

    $('subjectCameraMessage').textContent=
      'Camera unavailable. You can still continue after documenting the reason.';
  }
}

$('captureSubjectButton').onclick=()=>{

  const v=$('subjectVideo');

  if(!v.videoWidth){
    toast('Camera is not ready');
    return;
  }

  const c=document.createElement('canvas');

  c.width=v.videoWidth;
  c.height=v.videoHeight;

  c.getContext('2d').drawImage(
    v,
    0,
    0
  );

  subjectPhoto=
    c.toDataURL(
      'image/jpeg',
      .86
    );

  $('subjectSnapshot').src=
    subjectPhoto;

  $('subjectSnapshot').style.display=
    'block';

  v.style.display=
    'none';

  $('captureSubjectButton').hidden=
    true;

  $('retakeSubjectButton').hidden=
    false;

  toast('Subject photo captured');
};

$('retakeSubjectButton').onclick=()=>{

  subjectPhoto=null;

  $('subjectSnapshot').style.display=
    'none';

  $('subjectVideo').style.display=
    'block';

  $('captureSubjectButton').hidden=
    false;

  $('retakeSubjectButton').hidden=
    true;
};

$('continueSubjectButton').onclick=()=>{

  const name=
    $('subjectName').value.trim();

  const drug=
    $('subjectDrug').value.trim();

  const qty=
    $('subjectQuantity').value.trim();

  if(!name||!drug||!qty){

    $('subjectError').textContent=
      'Enter subject name, suspected drug and quantity.';

    return;
  }

  if(!subjectPhoto){

    $('subjectError').textContent=
      'Capture the subject photograph before continuing.';

    return;
  }

  $('subjectError').textContent='';

  showView('newTest');

  getGPS();
};


/* =========================================================
   GPS
   ========================================================= */

async function getGPS(){

  if(!navigator.geolocation){

    gps=null;

    updateGPS();

    return;
  }

  navigator.geolocation.getCurrentPosition(

    p=>{

      gps={
        lat:+p.coords.latitude.toFixed(6),
        lon:+p.coords.longitude.toFixed(6),
        accuracy:+p.coords.accuracy.toFixed(1)
      };

      updateGPS();
    },

    ()=>{
      gps=null;
      updateGPS();
    },

    {
      enableHighAccuracy:true,
      timeout:10000,
      maximumAge:0
    }
  );
}

function updateGPS(){

  $('locationCheck').textContent=
    gps?'✓':'○';

  $('locationText').textContent=
    gps
      ?`${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} (±${Math.round(gps.accuracy)} m)`
      :'GPS unavailable — continue only if appropriate';

  $('liveGps').textContent=
    gps
      ?`GPS: ${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}`
      :'GPS: unavailable';
}


/* =========================================================
   TEST CAMERA
   ========================================================= */

async function startTestCamera(){

  stopTestCamera();

  try{

    testStream=
      await navigator.mediaDevices.getUserMedia({
        video:{
          facingMode:{
            ideal:'environment'
          },
          width:{
            ideal:1280
          },
          height:{
            ideal:720
          }
        },
        audio:false
      });

    $('testVideo').srcObject=
      testStream;

    $('cameraCheck').textContent='✓';

    runLiveChecks();

  }catch(e){

    $('cameraCheck').textContent='!';

    toast(
      'Rear camera unavailable: '+e.message
    );
  }
}

function runLiveChecks(){

  const v=$('testVideo');
  const c=$('captureCanvas');

  const tick=()=>{

    if(!testStream)return;

    if(v.videoWidth){

      c.width=v.videoWidth;
      c.height=v.videoHeight;

      const ctx=c.getContext(
        '2d',
        {
          willReadFrequently:true
        }
      );

      ctx.drawImage(
        v,
        0,
        0,
        c.width,
        c.height
      );

      const s=sampleRegion(
        ctx,
        .08,
        .72,
        .34,
        .20,
        c.width,
        c.height
      );

      $('liveLight').textContent=
        s.avgLum>70&&s.avgLum<235
          ?'Lighting: OK'
          :'Lighting: adjust';

      $('liveFocus').textContent=
        s.contrast>25
          ?'Focus: OK'
          :'Focus: hold steady';
    }

    liveTimer=
      requestAnimationFrame(tick);
  };

  tick();
}


/* =========================================================
   IMAGE ANALYSIS
   ========================================================= */

function sampleRegion(
  ctx,
  xF,
  yF,
  wF,
  hF,
  W,
  H
){

  const x=Math.max(
    0,
    Math.floor(xF*W)
  );

  const y=Math.max(
    0,
    Math.floor(yF*H)
  );

  const w=Math.max(
    1,
    Math.min(
      W-x,
      Math.floor(wF*W)
    )
  );

  const h=Math.max(
    1,
    Math.min(
      H-y,
      Math.floor(hF*H)
    )
  );

  const d=ctx.getImageData(
    x,
    y,
    w,
    h
  ).data;

  let r=0;
  let g=0;
  let b=0;
  let n=0;

  let minL=255;
  let maxL=0;

  for(let i=0;i<d.length;i+=4){

    r+=d[i];
    g+=d[i+1];
    b+=d[i+2];

    n++;

    const l=
      .299*d[i]+
      .587*d[i+1]+
      .114*d[i+2];

    minL=Math.min(
      minL,
      l
    );

    maxL=Math.max(
      maxL,
      l
    );
  }

  return{
    r:r/n,
    g:g/n,
    b:b/n,
    avgLum:(r+g+b)/(3*n),
    contrast:maxL-minL
  };
}


/*
  3 × 3 = 9 points.

  Each point samples a small neighbourhood.
  The 9 samples are averaged.
  Variation between them becomes the consistency score.
*/
function ninePoint(
  ctx,
  zone,
  W,
  H
){

  const pts=[];

  const xs=[
    .18,
    .5,
    .82
  ];

  const ys=[
    .18,
    .5,
    .82
  ];

  for(const yf of ys){

    for(const xf of xs){

      const cx=
        zone.x+
        zone.w*xf;

      const cy=
        zone.y+
        zone.h*yf;

      pts.push(
        sampleRegion(
          ctx,
          cx-zone.sw/2,
          cy-zone.sh/2,
          zone.sw,
          zone.sh,
          W,
          H
        )
      );
    }
  }

  const avg=
    pts.reduce(
      (a,p)=>({
        r:a.r+p.r,
        g:a.g+p.g,
        b:a.b+p.b
      }),
      {
        r:0,
        g:0,
        b:0
      }
    );

  avg.r/=9;
  avg.g/=9;
  avg.b/=9;

  const distances=
    pts.map(
      p=>
        Math.sqrt(
          (p.r-avg.r)**2+
          (p.g-avg.g)**2+
          (p.b-avg.b)**2
        )
    );

  const meanDist=
    distances.reduce(
      (a,b)=>a+b,
      0
    )/9;

  const consistency=
    Math.max(
      0,
      Math.min(
        100,
        100-meanDist*1.65
      )
    );

  return{
    points:pts,
    avg,
    meanDist,
    consistency,
    valid:consistency>=70
  };
}

function rgbToHsv(r,g,b){

  r/=255;
  g/=255;
  b/=255;

  const mx=
    Math.max(r,g,b);

  const mn=
    Math.min(r,g,b);

  const d=
    mx-mn;

  let h=0;

  if(d){

    if(mx===r)
      h=60*(((g-b)/d)%6);

    else if(mx===g)
      h=60*((b-r)/d+2);

    else
      h=60*((r-g)/d+4);

    if(h<0)h+=360;
  }

  return{
    h,
    s:mx?d/mx:0,
    v:mx
  };
}


/*
  Prototype reagent reaction-colour profiles.
  These are NOT manufacturer-validated forensic thresholds.

  The classification logic uses the measured TEST colour and asks:
  "Does this colour fall inside one of the configured positive
  reaction-colour families for the selected reagent?"

  9-point consistency remains a QUALITY check only; it does not
  decide positive/negative by itself.
*/
const REACTION_PROFILES={
  Marquis:{
    positive:[
      {name:'Purple / black',hMin:250,hMax:330,sMin:.15,darkMaxV:.28},
      {name:'Orange / brown',hMin:8,hMax:55,sMin:.15}
    ]
  },
  Mecke:{
    positive:[
      {name:'Blue-green / green',hMin:110,hMax:200,sMin:.15},
      {name:'Purple',hMin:250,hMax:330,sMin:.15}
    ]
  },
  "Simon's":{
    positive:[
      {name:'Blue',hMin:195,hMax:250,sMin:.15}
    ]
  },
  Scott:{
    positive:[
      {name:'Blue',hMin:195,hMax:250,sMin:.15}
    ]
  },
  Other:{positive:[]}
};

function hueInRange(h,min,max){
  return h>=min&&h<=max;
}

// Euclidean RGB colour distance. Used only as a diagnostic measurement
// between the reference and test regions.
function colourDistance(a,b){
  const dr=(a.r||0)-(b.r||0);
  const dg=(a.g||0)-(b.g||0);
  const db=(a.b||0)-(b.b||0);
  return Math.sqrt(dr*dr+dg*dg+db*db);
}

function classify(
  ref,
  test,
  reagent
){
  /*
    Prototype decision model:
    1. Require consistent 9-point samples.
    2. Normalize test brightness against the reference.
    3. Check the measured TEST colour against the selected reagent's
       configured positive reaction-colour families.
    4. If it matches a configured positive reaction colour, classify
       as presumptive positive; otherwise classify as presumptive negative.

    These thresholds are for the presentation prototype only and are
    NOT manufacturer-validated forensic thresholds.
  */
  const refLum=Math.max(
    1,
    (ref.avg.r+ref.avg.g+ref.avg.b)/3
  );

  const scale=200/refLum;
  const corrected={
    r:Math.min(255,test.avg.r*scale),
    g:Math.min(255,test.avg.g*scale),
    b:Math.min(255,test.avg.b*scale)
  };

  const refHsv=rgbToHsv(ref.avg.r,ref.avg.g,ref.avg.b);
  const testHsv=rgbToHsv(corrected.r,corrected.g,corrected.b);

  const rgbDifference=colourDistance(ref.avg,test.avg);
  const rawHueShift=Math.abs(testHsv.h-refHsv.h);
  const hueShift=rawHueShift>180?360-rawHueShift:rawHueShift;
  const consistency=Math.min(ref.consistency,test.consistency);

  const profiles=REACTION_PROFILES[reagent]?.positive||[];
  let matchedReaction=null;

  for(const profile of profiles){
    if(profile.darkMaxV!=null && testHsv.v<=profile.darkMaxV){
      matchedReaction=profile.name;
      break;
    }

    if(
      hueInRange(testHsv.h,profile.hMin,profile.hMax) &&
      testHsv.s>=profile.sMin
    ){
      matchedReaction=profile.name;
      break;
    }
  }

  /* Keep hueDistance for the existing presentation diagnostics. */
  const hueDistance=matchedReaction
    ?0
    :profiles.length
      ?Math.min(...profiles.map(profile=>{
          if(profile.darkMaxV!=null&&testHsv.v<=profile.darkMaxV)return 0;
          if(testHsv.h<profile.hMin)return profile.hMin-testHsv.h;
          if(testHsv.h>profile.hMax)return testHsv.h-profile.hMax;
          return 0;
        }))
      :null;

  let category='INCONCLUSIVE';
  let reason='';

  if(!ref.valid||!test.valid){
    reason='Colour variation across the sampled area is too high.';
  }else if(!profiles.length){
    reason='No configured positive reaction-colour profile is available for this reagent.';
  }else if(matchedReaction){
    category='POSITIVE';
    reason=`The measured test colour matches the configured ${matchedReaction} reaction-colour profile for ${reagent}.`;
  }else{
    category='NEGATIVE';
    reason=`The measured test colour does not match any configured positive reaction-colour profile for ${reagent}.`;
  }

  const confidence=category==='INCONCLUSIVE'
    ?Math.round(consistency)
    :Math.round(Math.max(0,Math.min(100,
      55+
      Math.min(25,rgbDifference*.35)+
      (matchedReaction?20:0)+
      Math.max(0,hueShift-15)*.15+
      (consistency-70)*.2
    )));

  return{
    category,
    confidence,
    hue:testHsv.h,
    hueDistance,
    hueShift,
    referenceHue:refHsv.h,
    colourDifference:rgbDifference,
    corrected,
    matchedReaction,
    reason
  };
}

/* =========================================================
   CAPTURE
   ========================================================= */

function capture(){

  const v=$('testVideo');
  const c=$('captureCanvas');

  if(!v.videoWidth){

    toast('Camera is not ready');

    return;
  }

  c.width=v.videoWidth;
  c.height=v.videoHeight;

  const ctx=c.getContext(
    '2d',
    {
      willReadFrequently:true
    }
  );

  ctx.drawImage(
    v,
    0,
    0,
    c.width,
    c.height
  );

  capturedImage=
    c.toDataURL(
      'image/jpeg',
      .9
    );

  stopTestCamera();

  runAnalysis(c);
}

$('captureButton').onclick=
  capture;


/* =========================================================
   ANALYSIS
   ========================================================= */

function runAnalysis(c){

  showView('analysis');

  $('analysisContent').innerHTML=`
    <div class="eyebrow">ANALYSIS</div>
    <h2>Running quality and 9-point checks…</h2>
    <p class="lead">
      The image is being measured before a classification is shown.
    </p>
  `;

  setTimeout(()=>{

    /*
      Performance guard: camera captures can be several thousand pixels wide.
      The field-test analysis only needs reliable colour/quality measurements,
      so analyze a bounded copy instead of the full-resolution camera frame.
      The relative 3×3 sampling zones stay exactly the same.
    */
    const analysisMax=1000;
    const scale=Math.min(1,analysisMax/Math.max(c.width,c.height));
    const analysisCanvas=document.createElement('canvas');
    analysisCanvas.width=Math.max(1,Math.round(c.width*scale));
    analysisCanvas.height=Math.max(1,Math.round(c.height*scale));
    const analysisCtx=analysisCanvas.getContext('2d',{willReadFrequently:true});
    analysisCtx.drawImage(c,0,0,analysisCanvas.width,analysisCanvas.height);

    const ctx=analysisCtx;
    const W=analysisCanvas.width;
    const H=analysisCanvas.height;

    const ref=ninePoint(
      ctx,
      {
        x:.08,
        y:.72,
        w:.34,
        h:.20,
        sw:.035,
        sh:.035
      },
      W,
      H
    );

    const test=ninePoint(
      ctx,
      {
        x:.22,
        y:.14,
        w:.56,
        h:.28,
        sw:.035,
        sh:.035
      },
      W,
      H
    );

    const whole=
      sampleRegion(
        ctx,
        0,
        0,
        1,
        1,
        W,
        H
      );

    /*
      FIX:
      glare() returns the glare percentage.
      sampleRegion() does NOT return whole.glare.
    */
    const glareValue=
      glare(ctx);

    const sharpnessValue=
      sharpness(analysisCanvas);

    const quality={

      brightness:
        whole.avgLum,

      glare:
        glareValue,

      sharpness:
        sharpnessValue,

      brightnessPass:
        whole.avgLum>=45&&
        whole.avgLum<=215,

      glarePass:
        glareValue<12,

      sharpnessPass:
        sharpnessValue>=20,

      refPass:
        ref.valid,

      testPass:
        test.valid
    };

    const reagent=
      $('testType').value;

    const classification=
      classify(
        ref,
        test,
        reagent
      );

    const qualityPassed=
      quality.brightnessPass&&
      quality.glarePass&&
      quality.sharpnessPass&&
      quality.refPass&&
      quality.testPass;

    pendingRecord={
      analysis:{
        ref,
        test,
        quality,
        classification,
        reagent
      }
    };

    renderAnalysis(
      pendingRecord.analysis,
      qualityPassed
    );

  },350);
}


/* =========================================================
   GLARE
   ========================================================= */

function glare(ctx){

  const W=ctx.canvas.width;
  const H=ctx.canvas.height;

  const d=
    ctx.getImageData(
      0,
      0,
      W,
      H
    ).data;

  let n=0;
  let b=0;

  for(
    let i=0;
    i<d.length;
    i+=16
  ){

    if(
      d[i]>248&&
      d[i+1]>248&&
      d[i+2]>248
    ){
      b++;
    }

    n++;
  }

  return n
    ?b/n*100
    :0;
}


/* =========================================================
   SHARPNESS
   ========================================================= */

function sharpness(c){

  const W=
    Math.min(
      c.width,
      500
    );

  const H=
    Math.min(
      c.height,
      500
    );

  const tmp=
    document.createElement(
      'canvas'
    );

  tmp.width=W;
  tmp.height=H;

  const x=
    tmp.getContext(
      '2d',
      {
        willReadFrequently:true
      }
    );

  x.drawImage(
    c,
    0,
    0,
    W,
    H
  );

  const d=
    x.getImageData(
      0,
      0,
      W,
      H
    ).data;

  let sum=0;
  let sq=0;
  let n=0;

  for(
    let y=1;
    y<H-1;
    y+=2
  ){

    for(
      let xx=1;
      xx<W-1;
      xx+=2
    ){

      const p=
        (y*W+xx)*4;

      const l=
        .299*d[p]+
        .587*d[p+1]+
        .114*d[p+2];

      const up=
        .299*d[p-4*W]+
        .587*d[p-4*W+1]+
        .114*d[p-4*W+2];

      const dn=
        .299*d[p+4*W]+
        .587*d[p+4*W+1]+
        .114*d[p+4*W+2];

      const le=
        .299*d[p-4]+
        .587*d[p-3]+
        .114*d[p-2];

      const ri=
        .299*d[p+4]+
        .587*d[p+5]+
        .114*d[p+6];

      const lap=
        Math.abs(
          up+dn+le+ri-4*l
        );

      sum+=lap;
      sq+=lap*lap;
      n++;
    }
  }

  return n
    ?Math.max(
      0,
      (sq/n)-
      (sum/n)**2
    )
    :0;
}


/* =========================================================
   ANALYSIS SCREEN
   ========================================================= */

function renderAnalysis(
  a,
  qualityPassed
){

  const q=a.quality;
  const r=a.ref;
  const t=a.test;
  const c=a.classification;

  const finalCategory=
    qualityPassed
      ?c.category
      :'INCONCLUSIVE';

  let finalReason;

  if(qualityPassed){

    finalReason=
      c.reason;

  }else{

    const failed=[];

    if(!q.brightnessPass)
      failed.push('Brightness');

    if(!q.glarePass)
      failed.push('Glare');

    if(!q.sharpnessPass)
      failed.push('Sharpness');

    if(!q.refPass)
      failed.push('Reference 9-point consistency');

    if(!q.testPass)
      failed.push('Test 9-point consistency');

    finalReason=
      'Quality checks failed: '+
      failed.join(', ')+
      '.';
  }

  a.classification.category=
    finalCategory;

  a.classification.reason=
    finalReason;

  const cls=
    finalCategory.toLowerCase();

  const failedChecks=[];

  if(!q.brightnessPass)
    failedChecks.push(
      'Brightness is outside the acceptable range.'
    );

  if(!q.glarePass)
    failedChecks.push(
      'Too much glare was detected.'
    );

  if(!q.sharpnessPass)
    failedChecks.push(
      'Image sharpness is below the configured threshold.'
    );

  if(!q.refPass)
    failedChecks.push(
      'Reference area has inconsistent colour.'
    );

  if(!q.testPass)
    failedChecks.push(
      'Test area has inconsistent colour.'
    );

  const diagnostics=
    failedChecks.length
      ?`
        <div class="panel">
          <div class="eyebrow">
            QUALITY DIAGNOSTICS
          </div>

          <h3>
            Checks that need attention
          </h3>

          <ul>
            ${failedChecks
              .map(x=>`<li>${x}</li>`)
              .join('')}
          </ul>

          <p class="muted">
            Because one or more critical quality checks failed,
            this image is classified as INCONCLUSIVE.
          </p>
        </div>
      `
      :`
        <div class="panel">
          <div class="eyebrow">
            QUALITY DIAGNOSTICS
          </div>

          <h3>
            ✓ All critical quality checks passed
          </h3>

          <p class="muted">
            The image passed brightness, glare, sharpness
            and 9-point consistency checks.
          </p>
        </div>
      `;

  $('analysisContent').innerHTML=`

    <div class="result-banner ${cls}">

      <div class="eyebrow">
        FIELD SCREENING RESULT
      </div>

      <h3>
        ${
          finalCategory==='POSITIVE'
            ?'PRESUMPTIVE POSITIVE'
            :finalCategory==='NEGATIVE'
              ?'PRESUMPTIVE NEGATIVE'
              :'INCONCLUSIVE'
        }
      </h3>

      <p>
        ${escapeHtml(finalReason)}
      </p>

    </div>


    <div class="analysis-grid">

      <div class="metric">
        <span>Brightness</span>
        <strong>
          ${q.brightness.toFixed(0)}
          ${q.brightnessPass?'✓':'⚠'}
        </strong>
      </div>

      <div class="metric">
        <span>Glare</span>
        <strong>
          ${q.glare.toFixed(1)}%
          ${q.glarePass?'✓':'⚠'}
        </strong>
      </div>

      <div class="metric">
        <span>Sharpness</span>
        <strong>
          ${q.sharpness.toFixed(0)}
          ${q.sharpnessPass?'✓':'⚠'}
        </strong>
      </div>

      <div class="metric">
        <span>Reference consistency</span>
        <strong>
          ${r.consistency.toFixed(0)}%
          ${r.valid?'✓':'⚠'}
        </strong>
      </div>

      <div class="metric">
        <span>Test consistency</span>
        <strong>
          ${t.consistency.toFixed(0)}%
          ${t.valid?'✓':'⚠'}
        </strong>
      </div>

      <div class="metric">
        <span>Hue distance</span>
        <strong>
          ${c.hueDistance.toFixed(1)}°
        </strong>
      </div>

      <div class="metric">
        <span>RGB colour difference</span>
        <strong>
          ${c.colourDifference.toFixed(1)}
        </strong>
      </div>

    </div>


    ${diagnostics}


    <div class="consistency-grid">

      <div class="metric">

        <span>
          Reference 3×3 sampling
        </span>

        <div class="grid9">

          ${r.points
            .map(
              p=>`
                <span
                  title="RGB ${Math.round(p.r)}, ${Math.round(p.g)}, ${Math.round(p.b)}"
                  style="
                    background:rgb(
                      ${Math.round(p.r)},
                      ${Math.round(p.g)},
                      ${Math.round(p.b)}
                    )
                  "
                ></span>
              `
            )
            .join('')}

        </div>

      </div>


      <div class="metric">

        <span>
          Test 3×3 sampling
        </span>

        <div class="grid9">

          ${t.points
            .map(
              p=>`
                <span
                  title="RGB ${Math.round(p.r)}, ${Math.round(p.g)}, ${Math.round(p.b)}"
                  style="
                    background:rgb(
                      ${Math.round(p.r)},
                      ${Math.round(p.g)},
                      ${Math.round(p.b)}
                    )
                  "
                ></span>
              `
            )
            .join('')}

        </div>

      </div>

    </div>


    <p class="muted">
      Configured prototype threshold:
      78% minimum 9-point consistency.
      Colour profiles are configurable and are
      not manufacturer-validated.
    </p>


    <button
      class="primary-button large"
      id="continueToReview"
    >
      Continue to result review →
    </button>


    <button
      class="secondary-button large"
      id="retakeFromAnalysis"
    >
      Retake image
    </button>
  `;

  $('continueToReview').onclick=
    ()=>buildReview(a);

  $('retakeFromAnalysis').onclick=()=>{

    capturedImage=null;

    showView('capture');

    startTestCamera();
  };
}


/* =========================================================
   BUILD REVIEW
   ========================================================= */

async function buildReview(a){

  showView('review');

  const timestamp=
    new Date().toISOString();

  const imageHash=
    await sha256DataUrl(
      capturedImage
    );

  const testId=
    'NARC-TEST-'+
    Date.now()
      .toString(36)
      .toUpperCase();

  const sealPayload={

    testId,

    operatorId:
      currentUser.badgeNumber,

    result:
      a.classification.category,

    timestamp,

    gps,

    subject:
      $('subjectName').value.trim(),

    drug:
      $('subjectDrug').value.trim(),

    quantity:
      $('subjectQuantity').value.trim(),

    reagent:
      a.reagent,

    imageHash,

    refAvg:
      a.ref.avg,

    testAvg:
      a.test.avg,

    refConsistency:
      a.ref.consistency,

    testConsistency:
      a.test.consistency,

    colourDifference:
      a.classification.colourDifference,

    analysisVersion:
      'V2.9POINT.1'
  };

  const sealHash=
    await sha256Text(
      JSON.stringify(
        sealPayload
      )
    );

  pendingRecord={
    ...sealPayload,

    subjectPhotoDataUrl:
      subjectPhoto,

    testImageDataUrl:
      capturedImage,

    confidence:
      a.classification.confidence,

    reason:
      a.classification.reason,

    classificationProfile:
      'Prototype reagent profile',

    sealHash
  };

  renderReview();
}


/* =========================================================
   REVIEW SCREEN
   ========================================================= */

function renderReview(){

  $('reviewResult').innerHTML=`

    <div class="result-banner ${
      pendingRecord.result.toLowerCase()
    }">

      <div class="eyebrow">
        RESULT READY
      </div>

      <h3>
        ${
          pendingRecord.result==='POSITIVE'
            ?'PRESUMPTIVE POSITIVE'
            :pendingRecord.result==='NEGATIVE'
              ?'PRESUMPTIVE NEGATIVE'
              :'INCONCLUSIVE'
        }
      </h3>

      <p>
        ${escapeHtml(
          pendingRecord.reason
        )}
      </p>

    </div>
  `;

  $('reviewImage').src=
    pendingRecord.testImageDataUrl;

  $('reviewDetails').innerHTML=[

    ['Test ID',pendingRecord.testId],

    ['Officer',pendingRecord.operatorId],

    ['Reagent',pendingRecord.reagent],

    ['Subject',pendingRecord.subject],

    ['Drug',pendingRecord.drug],

    ['Quantity',pendingRecord.quantity],

    ['Confidence',
      pendingRecord.confidence+'%'
    ],

    ['Location',
      gps
        ?`${gps.lat}, ${gps.lon}`
        :'Unavailable'
    ],

    ['Reference consistency',
      pendingRecord.refConsistency.toFixed(1)+'%'
    ],

    ['Test consistency',
      pendingRecord.testConsistency.toFixed(1)+'%'
    ],

    ['Colour difference',
      pendingRecord.colourDifference?.toFixed(1)??'—'
    ],

    ['Image SHA-256',
      pendingRecord.imageHash
    ],

    ['Seal',
      pendingRecord.sealHash
    ]

  ]
  .map(
    x=>`
      <div class="metric">
        <span>${x[0]}</span>
        <strong>${escapeHtml(
          String(x[1]??'—')
        )}</strong>
      </div>
    `
  )
  .join('');
}


/* =========================================================
   SAVE RECORD → NEW narc_tests TABLE
   ========================================================= */

async function saveRecord(){

  if(!pendingRecord)return;

  const btn=$('saveButton');

  btn.disabled=true;

  btn.textContent=
    'Sealing…';

  try{

    const r=pendingRecord;

    const row={

      test_id:
        r.testId,

      timestamp:
        r.timestamp,

      officer_id:
        r.operatorId||null,

      officer_name:
        currentUser?.name||null,

      subject_name:
        r.subject||null,

      aadhaar_number:
        $('subjectAadhaar').value.trim()||null,

      drug:
        r.drug||null,

      quantity:
        r.quantity||null,

      reagent:
        r.reagent||null,

      latitude:
        r.gps?.lat??null,

      longitude:
        r.gps?.lon??null,

      location:
        r.gps
          ?`${r.gps.lat}, ${r.gps.lon}`
          :null,

      result:
        r.result||null,

      confidence:
        r.confidence??null,

      subject_photo:
        r.subjectPhotoDataUrl||null,

      test_image:
        r.testImageDataUrl||null,

      reference_colour:
        r.refAvg
          ?JSON.stringify(r.refAvg)
          :null,

      test_colour:
        r.testAvg
          ?JSON.stringify(r.testAvg)
          :null,

      colour_difference:
        r.colourDifference??null,

      consistency_score:
        Math.min(
          r.refConsistency??0,
          r.testConsistency??0
        ),

      image_hash:
        r.imageHash||null,

      sealed_hash:
        r.sealHash||null,

      disclaimer:
        'Field-screening result only. Not laboratory confirmation.'
    };

    if(!sb){

      throw new Error(
        'Supabase is not connected.'
      );
    }

    const {
      error
    }=await sb
      .from('narc_tests')
      .insert(row);

    if(error)throw error;


    /* Local backup */

    const local=
      JSON.parse(
        localStorage.getItem(
          'narcLocalRecords'
        )||'[]'
      );

    local.unshift(r);

    localStorage.setItem(
      'narcLocalRecords',
      JSON.stringify(local)
    );

    toast(
      'Record sealed and saved to Supabase'
    );

    pendingRecord=null;

    resetTest();

    showView('records');

  }catch(e){

    console.error(e);

    toast(
      'Save failed: '+e.message
    );

  }finally{

    btn.disabled=false;

    btn.innerHTML=
      'Seal & save record <span>→</span>';
  }
}


/* =========================================================
   RESET
   ========================================================= */

function resetTest(){

  stopAll();

  subjectPhoto=null;
  capturedImage=null;
  gps=null;

  [
    'subjectName',
    'subjectAadhaar',
    'subjectDrug',
    'subjectQuantity'
  ].forEach(
    id=>{
      if($(id))
        $(id).value='';
    }
  );

  $('subjectSnapshot').style.display=
    'none';

  $('subjectVideo').style.display=
    'block';

  $('captureSubjectButton').hidden=
    false;

  $('retakeSubjectButton').hidden=
    true;
}


/* =========================================================
   LOAD RECORDS FROM NEW narc_tests TABLE
   ========================================================= */

async function loadRecords(){

  let remote=[];

  if(sb){

    try{

      const {
        data,
        error
      }=await sb
        .from('narc_tests')
        .select(`
          test_id,
          timestamp,
          officer_id,
          officer_name,
          subject_name,
          aadhaar_number,
          drug,
          quantity,
          reagent,
          latitude,
          longitude,
          location,
          result,
          confidence,
          subject_photo,
          test_image,
          reference_colour,
          test_colour,
          colour_difference,
          consistency_score,
          image_hash,
          sealed_hash,
          disclaimer
        `)
        .order(
          'timestamp',
          {
            ascending:false
          }
        );

      if(!error){

        remote=
          (data||[])
            .map(rowToRecord);
      }

    }catch(e){

      console.warn(e);
    }
  }


  const local=
    JSON.parse(
      localStorage.getItem(
        'narcLocalRecords'
      )||'[]'
    );

  const map=new Map();

  [
    ...local,
    ...remote
  ].forEach(
    r=>map.set(
      r.testId,
      r
    )
  );

  return[
    ...map.values()
  ].sort(
    (a,b)=>
      new Date(b.timestamp)-
      new Date(a.timestamp)
  );
}


/* =========================================================
   SUPABASE ROW → APP RECORD
   ========================================================= */

function rowToRecord(r){

  let refAvg=null;
  let testAvg=null;

  try{

    if(r.reference_colour)
      refAvg=
        JSON.parse(
          r.reference_colour
        );

  }catch(e){
    console.warn(
      'Reference colour parse failed',
      e
    );
  }

  try{

    if(r.test_colour)
      testAvg=
        JSON.parse(
          r.test_colour
        );

  }catch(e){
    console.warn(
      'Test colour parse failed',
      e
    );
  }


  return{

    testId:
      r.test_id,

    timestamp:
      r.timestamp,

    operatorId:
      r.officer_id,

    officerName:
      r.officer_name,

    result:
      r.result,

    confidence:
      Number(r.confidence)||0,

    gps:
      r.latitude!=null
        ?{
          lat:Number(r.latitude),
          lon:Number(r.longitude),
          accuracy:null
        }
        :null,

    subject:
      r.subject_name,

    aadhaarNumber:
      r.aadhaar_number,

    drug:
      r.drug,

    quantity:
      r.quantity,

    reagent:
      r.reagent,

    subjectPhotoDataUrl:
      r.subject_photo,

    testImageDataUrl:
      r.test_image,

    refAvg,

    testAvg,

    colourDifference:
      r.colour_difference!=null
        ?Number(r.colour_difference)
        :null,

    refConsistency:
      r.consistency_score!=null
        ?Number(r.consistency_score)
        :null,

    testConsistency:
      r.consistency_score!=null
        ?Number(r.consistency_score)
        :null,

    imageHash:
      r.image_hash,

    sealHash:
      r.sealed_hash,

    hashIv:
      'plain-seal-v1',

    analysisVersion:
      'V2.9POINT.1',

    reason:
      r.disclaimer||
      'Field-screening record, not laboratory confirmation.',

    location:
      r.location
  };
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function withinDays(r,d){

  return Date.now()-
    new Date(
      r.timestamp
    ).getTime()
    <=d*86400000;
}

async function loadDashboard(){

  records=
    await loadRecords();

  const today=
    new Date().toDateString();

  const todayN=
    records.filter(
      r=>
        new Date(
          r.timestamp
        ).toDateString()===today
    ).length;

  const week=
    records.filter(
      r=>withinDays(r,7)
    );

  const month=
    records.filter(
      r=>withinDays(r,30)
    );

  $('statToday').textContent=
    todayN;

  $('statWeek').textContent=
    week.length;

  $('statMonth').textContent=
    month.length;

  $('statQuantity').textContent=
    week.reduce(
      (a,r)=>
        a+
        (
          parseFloat(
            String(
              r.quantity||''
            ).replace(
              /[^0-9.]/g,
              ''
            )
          )||0
        ),
      0
    ).toFixed(2)+' g';

  $('countPositive').textContent=
    week.filter(
      r=>r.result==='POSITIVE'
    ).length;

  $('countNegative').textContent=
    week.filter(
      r=>r.result==='NEGATIVE'
    ).length;

  $('countInconclusive').textContent=
    week.filter(
      r=>r.result==='INCONCLUSIVE'
    ).length;

  drawChart(
    week,
    $('chartMetric').value
  );

  setupActivityDatePicker();
  renderDashboardActivity(week, selectedActivityDate);
}

function drawChart(
  rs,
  metric
){

  const days=[];

  for(
    let i=6;
    i>=0;
    i--
  ){

    const d=
      new Date(
        Date.now()-
        i*86400000
      );

    days.push({
      label:
        d.toLocaleDateString(
          undefined,
          {
            weekday:'short'
          }
        ),

      date:
        d.toDateString(),

      v:0
    });
  }

  rs.forEach(r=>{

    const d=
      days.find(
        x=>
          x.date===
          new Date(
            r.timestamp
          ).toDateString()
      );

    if(d)d.v++;
  });

  if(metric!=='tests'){

    days.forEach(d=>{

      d.v=
        rs.filter(
          r=>
            new Date(
              r.timestamp
            ).toDateString()===
            d.date&&
            r.result===
            metric.toUpperCase()
        ).length;
    });
  }

  const max=
    Math.max(
      1,
      ...days.map(
        d=>d.v
      )
    );

  $('trendChart').innerHTML=
    days.map(
      d=>`
        <div class="bar-col">

          <span class="bar-value">
            ${d.v}
          </span>

          <div
            class="bar"
            style="
              height:${Math.max(
                3,
                d.v/max*78
              )}%
            "
          ></div>

          <span class="bar-label">
            ${d.label}
          </span>

        </div>
      `
    ).join('');
}

function locationText(r){

  if(r.gps){

    return `${r.gps.lat.toFixed(4)}, ${r.gps.lon.toFixed(4)}`;
  }

  return r.location||'—';
}

function pill(r){

  const c=
    r.result==='POSITIVE'
      ?'positive'
      :r.result==='NEGATIVE'
        ?'negative'
        :'inconclusive';

  return`
    <span class="result-pill ${c}">
      ${
        r.result==='POSITIVE'
          ?'PRESUMPTIVE POSITIVE'
          :r.result==='NEGATIVE'
            ?'PRESUMPTIVE NEGATIVE'
            :'INCONCLUSIVE'
      }
    </span>
  `;
}

function localDateKey(d){
  const x=d instanceof Date?new Date(d):new Date(d);
  const y=x.getFullYear();
  const m=String(x.getMonth()+1).padStart(2,'0');
  const day=String(x.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function setupActivityDatePicker(){
  const input=$('activityDate');
  if(!input)return;

  const today=new Date();
  const min=new Date();
  min.setDate(today.getDate()-6);

  input.max=localDateKey(today);
  input.min=localDateKey(min);

  if(!selectedActivityDate||selectedActivityDate<input.min||selectedActivityDate>input.max){
    selectedActivityDate=localDateKey(today);
  }

  input.value=selectedActivityDate;

  input.onchange=()=>{
    const value=input.value;
    if(value<input.min||value>input.max){
      toast('Please select a date from the last 7 days.');
      input.value=selectedActivityDate;
      return;
    }
    selectedActivityDate=value;
    renderDashboardActivity(records.filter(r=>withinDays(r,7)), selectedActivityDate);
  };
}

function renderDashboardActivity(rs,dateKey){
  const list=$('dashboardDailyList');
  const summary=$('selectedDateSummary');
  if(!list||!summary)return;

  const dayRecords=rs.filter(r=>localDateKey(r.timestamp)===dateKey);
  const displayDate=new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short',year:'numeric'});

  summary.innerHTML=`<div class="selected-date-card"><strong>${escapeHtml(displayDate)}</strong><span>${dayRecords.length} test${dayRecords.length===1?'':'s'} recorded</span></div>`;

  if(!dayRecords.length){
    list.innerHTML='<div class="empty-activity">No tests recorded on this date.</div>';
    return;
  }

  list.innerHTML=dayRecords.map(r=>`
    <article class="daily-activity-card">
      <div class="daily-activity-main">
        <strong>${escapeHtml(r.drug||'Drug not specified')}</strong>
        <span>${escapeHtml(r.quantity||'Quantity not specified')}</span>
      </div>
      <div class="daily-activity-location">
        <span>LOCATION</span>
        <strong>${escapeHtml(locationText(r))}</strong>
      </div>
    </article>
  `).join('');
}

/* =========================================================
   RECORDS
   ========================================================= */

function renderRecords(){

  const search=
    ($('recordSearch')?.value||'')
      .toLowerCase();

  const op=
    $('recordOperatorFilter')?.value||'';

  let rs=
    records.filter(
      r=>
        (!op||
          r.operatorId===op
        )&&
        (
          !search||
          [
            r.subject,
            r.drug,
            r.result,
            r.operatorId,
            r.testId
          ].some(
            x=>
              String(
                x||''
              )
              .toLowerCase()
              .includes(search)
          )
        )
    );

  $('recordList').innerHTML=
    rs.map(
      r=>`
        <article
          class="record-card"
          data-id="${r.testId}"
        >

          <div class="record-head">

            <div>

              <div class="eyebrow">
                ${new Date(
                  r.timestamp
                ).toLocaleString()}
              </div>

              <strong>
                ${escapeHtml(
                  r.testId
                )}
              </strong>

            </div>

            ${pill(r)}

          </div>

          <div class="record-meta">

            <div>
              <span>Subject</span>
              <strong>
                ${escapeHtml(
                  r.subject||'—'
                )}
              </strong>
            </div>

            <div>
              <span>Drug</span>
              <strong>
                ${escapeHtml(
                  r.drug||'—'
                )}
              </strong>
            </div>

            <div>
              <span>Quantity</span>
              <strong>
                ${escapeHtml(
                  r.quantity||'—'
                )}
              </strong>
            </div>

            <div>
              <span>Location</span>
              <strong>
                ${locationText(r)}
              </strong>
            </div>

          </div>

        </article>
      `
    )
    .join('')
    ||
    `
      <p class="muted">
        No matching records.
      </p>
    `;

  qa('.record-card').forEach(
    e=>
      e.onclick=
        ()=>openDetail(
          e.dataset.id
        )
  );
}


/* =========================================================
   RECORD DETAIL
   ========================================================= */

function openDetail(id){

  const r=
    records.find(
      x=>x.testId===id
    );

  if(!r)return;

  $('detailTitle').textContent=
    r.testId;

  $('detailResult').innerHTML=`

    <div class="result-banner ${
      r.result.toLowerCase()
    }">

      <h3>
        ${
          r.result==='POSITIVE'
            ?'PRESUMPTIVE POSITIVE'
            :r.result==='NEGATIVE'
              ?'PRESUMPTIVE NEGATIVE'
              :'INCONCLUSIVE'
        }
      </h3>

      <p>
        This is a field-screening record,
        not laboratory confirmation.
      </p>

    </div>
  `;

  $('detailSubjectImage').src=
    r.subjectPhotoDataUrl||'';

  $('detailSubjectImage').style.display=
    r.subjectPhotoDataUrl
      ?'block'
      :'none';

  $('detailTestImage').src=
    r.testImageDataUrl||'';

  $('detailFields').innerHTML=[

    ['Subject',r.subject],

    ['Aadhaar / ID',
      r.aadhaarNumber],

    ['Drug',r.drug],

    ['Quantity',r.quantity],

    ['Reagent',r.reagent],

    ['Officer',r.operatorId],

    ['Timestamp',r.timestamp],

    ['GPS',locationText(r)],

    ['Confidence',
      r.confidence+'%'],

    ['Colour difference',
      r.colourDifference],

    ['Seal',r.sealHash]

  ]
  .map(
    x=>`
      <div class="metric">

        <span>
          ${x[0]}
        </span>

        <strong>
          ${escapeHtml(
            String(
              x[1]??'—'
            )
          )}
        </strong>

      </div>
    `
  )
  .join('');

  $('detailVerifyResult').textContent='';

  $('detailVerifyButton').onclick=
    ()=>verifyObject(
      r,
      $('detailVerifyResult')
    );

  showView('detail');
}


/* =========================================================
   VERIFY RECORD
   ========================================================= */

async function verifyObject(
  r,
  box
){

  box.textContent=
    'Verifying…';

  try{

    let ok=false;

    if(
      r.hashIv==='plain-seal-v1'||
      r.hashIv===''

    ){

      const payload={

        testId:
          r.testId,

        operatorId:
          r.operatorId,

        result:
          r.result,

        timestamp:
          r.timestamp,

        gps:
          r.gps,

        subject:
          r.subject,

        drug:
          r.drug,

        quantity:
          r.quantity,

        reagent:
          r.reagent,

        imageHash:
          r.imageHash,

        refAvg:
          r.refAvg,

        testAvg:
          r.testAvg,

        refConsistency:
          r.refConsistency,

        testConsistency:
          r.testConsistency,

        colourDifference:
          r.colourDifference,

        analysisVersion:
          r.analysisVersion||
          'V2.9POINT.1'
      };

      if(
        r.sealHash&&
        r.imageHash
      ){

        ok=
          (
            await sha256Text(
              JSON.stringify(
                payload
              )
            )
          )===r.sealHash;

      }else{

        ok=!!r.sealHash;
      }

    }else{

      ok=false;
    }

    box.className=
      'verification-box '+
      (
        ok
          ?'ok'
          :'bad'
      );

    box.innerHTML=
      ok
        ?'✓ INTEGRITY VERIFIED — sealed record matches its stored integrity data.'
        :'⚠ Verification unavailable or mismatch. The record should be reviewed.';

  }catch(e){

    box.className=
      'verification-box bad';

    box.textContent=
      'Verification failed: '+
      e.message;
  }
}

$('verifyRecordButton').onclick=
  async()=>{

    const id=
      $('verifyRecordId')
        .value
        .trim();

    const box=
      $('verificationResult');

    const r=
      records.find(
        x=>x.testId===id
      );

    if(!r){

      box.className=
        'verification-box bad';

      box.textContent=
        'Record not found.';

      return;
    }

    await verifyObject(
      r,
      box
    );
};


/* =========================================================
   UTILITY
   ========================================================= */

function escapeHtml(v){

  return String(v).replace(
    /[&<>"']/g,
    c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[c])
  );
}


/* =========================================================
   LOGIN
   ========================================================= */

$('loginForm').onsubmit=
  async e=>{

    e.preventDefault();

    const err=
      $('loginError');

    err.textContent='';

    const badge=
      normalizeBadge(
        $('loginBadge').value
      );

    const pw=
      $('loginPassword').value;

    if(!badge||!pw)return;

    try{

      const u=
        await getOfficer(
          badge
        );

      if(!u){

        err.textContent=
          'No account found for that badge number.';

        return;
      }

      const valid=
        await verifyPassword(
          pw,
          u.password_hash
        );

      if(!valid){

        err.textContent=
          'Incorrect password.';

        return;
      }

      const roleText=
        String(
          u.role||
          'Field Officer'
        );

      const normalizedRole=
        roleText
          .toLowerCase()
          .includes('supervisor')
          ?'supervisor'
          :'Field Officer';

      currentUser={

        badgeNumber:
          u.officer_id,

        role:
          normalizedRole,

        name:
          u.name||
          u.officer_id
      };

      sessionStorage.setItem(
        'narcUser',
        JSON.stringify(
          currentUser
        )
      );

      onLogin();

    }catch(e){

      console.error(e);

      err.textContent=
        'Sign-in failed: '+
        e.message;
    }
  };


/* =========================================================
   REGISTRATION → NEW narc_officers TABLE
   ========================================================= */

$('registerForm').onsubmit=
  async e=>{

    e.preventDefault();

    const err=
      $('regError');

    err.textContent='';

    const badge=
      normalizeBadge(
        $('regBadge').value
      );

    const roleValue=
      q(
        'input[name="regRole"]:checked'
      )?.value||
      'field_officer';

    const role=
      roleValue==='supervisor'
        ?'Supervisor'
        :'Field Officer';

    const pw=
      $('regPassword').value;

    const pw2=
      $('regPassword2').value;

    /*
      If your HTML contains regName,
      it will be used.

      If it doesn't, the badge is used
      as a fallback so the registration
      doesn't break.
    */
    const name=
      $('regName')?.value.trim()||
      badge;

    if(
      !badge||
      pw.length<8||
      pw!==pw2
    ){

      err.textContent=
        pw.length<8
          ?'Password must be at least 8 characters.'
          :'Passwords do not match or badge is empty.';

      return;
    }

    try{

      if(!sb){
        throw new Error('Supabase is not connected. Refresh the page and try again.');
      }

      const passwordHash=
        await createPasswordHash(
          pw
        );

      const {
        error
      }=await sb
        .from('narc_officers')
        .insert({

          officer_id:
            badge,

          name:
            name,

          password_hash:
            passwordHash,

          role:
            role
        });

      if(error)throw error;

      $('loginBadge').value=
        badge;

      showAuth('login');

      toast(
        'Officer account created'
      );

    }catch(e){

      console.error(e);

      const msg=String(e?.message||e);

      err.textContent=
        msg.includes('duplicate key')||msg.includes('unique constraint')
          ?'That Officer / Badge ID is already registered.'
          :msg.includes('row-level security')
            ?'Registration was blocked by Supabase Row Level Security. Check the INSERT policy on narc_officers.'
            :'Registration failed: '+msg;
    }
  };


/* =========================================================
   AUTH / SESSION
   ========================================================= */

function showAuth(n){

  $('loginScreen')
    .classList.toggle(
      'active',
      n==='login'
    );

  $('registerScreen')
    .classList.toggle(
      'active',
      n==='register'
    );
}

$('goRegister').onclick=
  ()=>showAuth('register');

$('backToLogin').onclick=
  ()=>showAuth('login');

$('logoutButton').onclick=()=>{

  sessionStorage.removeItem(
    'narcUser'
  );

  currentUser=null;

  stopAll();

  $('appScreen')
    .classList.remove(
      'active'
    );

  showAuth('login');
};

function onLogin(){

  showAuth('none');

  $('loginScreen')
    .classList.remove(
      'active'
    );

  $('registerScreen')
    .classList.remove(
      'active'
    );

  $('appScreen')
    .classList.add(
      'active'
    );

  $('sessionName').textContent=
    currentUser.name;

  $('sessionRole').textContent=
    currentUser.role==='supervisor'
      ?'SUPERVISOR'
      :'FIELD OFFICER';

  $('avatar').textContent=
    currentUser.badgeNumber
      .slice(0,2);

  $('preparationOperator').textContent=
    `${currentUser.name} • ${currentUser.badgeNumber}`;

  loadDashboard();
}


/* =========================================================
   BUTTONS
   ========================================================= */

$('startTestButton').onclick=
  ()=>showView('subject');

$('openRecordsButton').onclick=
  ()=>showView('records');

$('verifyButton').onclick=
  ()=>showView('verify');

$('beginCaptureButton').onclick=()=>{

  showView('capture');

  startTestCamera();

  getGPS();
};

$('captureBackButton').onclick=
  ()=>showView('newTest');

$('analysisBackButton').onclick=
  ()=>showView('capture');

$('reviewBackButton').onclick=
  ()=>showView('analysis');

$('discardButton').onclick=()=>{

  pendingRecord=null;

  resetTest();

  showView('dashboard');
};

$('saveButton').onclick=
  saveRecord;

$('detailBackButton').onclick=
  ()=>showView('records');

$('chartMetric').onchange=
  ()=>drawChart(
    records.filter(
      r=>withinDays(r,7)
    ),
    $('chartMetric').value
  );

$('recordSearch').oninput=
  renderRecords;

$('recordOperatorFilter').onchange=
  renderRecords;

qa('[data-back]').forEach(
  b=>
    b.onclick=()=>{
      stopAll();
      showView('dashboard');
    }
);

qa('.nav-item').forEach(
  b=>
    b.onclick=
      ()=>showView(
        b.dataset.nav
      )
);


/* =========================================================
   RESTORE SESSION
   ========================================================= */

(async()=>{

  const saved=
    sessionStorage.getItem(
      'narcUser'
    );

  if(saved){

    try{

      currentUser=
        JSON.parse(saved);

      onLogin();

    }catch{}

  }

})();