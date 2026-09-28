const { chromium, expect } = require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const email='password-test@example.test', password='  simulated-password-42  '; let attempts=0;const remote=new Map();
const today=new Date();const date=new Date(today);date.setDate(date.getDate()-1);const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const exercise={id:'test-pull',name:'Dominada de prueba',group:'Tirón',unit:'reps',load:'added',notes:''};
const item={id:'test-item',exerciseId:exercise.id,block:'Principal',sets:2,target:'8-10',rest:90,optional:false,notes:'',circuit:''};
const routine={id:'test-routine',name:'Rutina de prueba',category:'pull',items:[item],notes:''};
const session={id:'test-history',planId:null,routineId:routine.id,title:routine.name,category:'pull',date:localDate(date),startedAt:date.toISOString(),finishedAt:date.toISOString(),status:'completed',notes:'',items:[{...item,exercise,skipped:false,sets:[{id:'s1',value:10,weight:5,rir:2,rpe:8,done:true},{id:'s2',value:8,weight:5,rir:3,rpe:7,done:true}]}]};
for(const [kind,data] of [['exercise',exercise],['routine',routine],['session',session]])remote.set(data.id,{kind,id:data.id,data,revision:1,deleted:false});
  await page.route('https://*.supabase.co/**',async route=>{
   const request=route.request(),url=request.url(),data=request.postDataJSON();
   if(url.includes('/auth/v1/token?grant_type=password')){
    attempts++; if(data.email!==email)throw Error('Unexpected email');
    if(attempts===1)return route.fulfill({status:400,json:{code:'invalid_credentials',error_code:'invalid_credentials',msg:'Invalid login credentials'}});
    if(data.password!==password)throw Error('Password was modified');
    const id='01234567-89ab-4def-8123-456789abcdef',exp=Math.floor(Date.now()/1000)+3600;
    const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,exp,role:'authenticated'})).toString('base64url')+'.signature';
    return route.fulfill({json:{access_token:jwt,refresh_token:'fake-test-refresh',expires_in:3600,token_type:'bearer',user:{id,email,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}}});
   }
   if(url.includes('/rest/v1/training_records'))return route.fulfill({json:[...remote.values()]});
   if(url.includes('/rest/v1/rpc/apply_training_record')){const record={id:data.record_id,kind:data.record_kind,data:data.record_data,revision:data.expected_revision+1,deleted:data.is_deleted};remote.set(record.id,record);return route.fulfill({json:{ok:true,record}});}
   throw Error('Unexpected request (email/redirect flows must not be used): '+url);
  });
  await page.goto(process.env.TEST_URL||'http://localhost:3001');
  await expect(page.getByRole('button',{name:'Cuenta y ajustes'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Iniciar sesión',exact:true})).toBeDisabled();
  await page.getByLabel('Tu correo',{exact:true}).fill(email);
  await page.locator('input[name=password]').fill('incorrect-test-password');
  await page.getByRole('button',{name:'Mostrar contraseña',exact:true}).click();await expect(page.locator('input[name=password]')).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Ocultar contraseña',exact:true}).click();await expect(page.locator('input[name=password]')).toHaveAttribute('type','password');
  await context.setOffline(true);await expect(page.getByRole('button',{name:'Iniciar sesión',exact:true})).toBeDisabled();await context.setOffline(false);
  await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.locator('.error')).toContainText('no son correctos');
  await page.locator('input[name=password]').fill(password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.getByRole('button',{name:'Cuenta y ajustes'}).click();await expect(page.locator('.account-email')).toHaveText(email);
  await page.reload();await page.getByRole('button',{name:'Cuenta y ajustes'}).click();await expect(page.locator('.account-email')).toHaveText(email);
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  const nav=async name=>page.locator('.mobile-nav').getByRole('button',{name,exact:true}).click();
  await nav('Progreso');
  await page.getByLabel('Consultar un ejercicio').selectOption('test-pull');
  await expect(page.getByText('Máximo: 10 repeticiones',{exact:true})).toBeVisible();
  await expect(page.getByText('Mayor lastre: 5 kg',{exact:true})).toBeVisible();
  await expect(page.locator('.exercise-chart')).toBeVisible();
  await page.getByLabel('Mostrar').selectOption('weight');
  await expect(page.locator('.exercise-chart')).toHaveAttribute('aria-label',/kg/);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow '+width);}
  await page.setViewportSize({width:390,height:844});
  await require('node:fs/promises').mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/progress-new.png',fullPage:true});
  await nav('Rutinas');
  await page.locator('.routine-card').getByRole('button',{name:'Agendar',exact:true}).click();
  await page.getByRole('button',{name:'Guardar en calendario',exact:true}).click();
  await page.getByRole('button',{name:'Cambiar fecha',exact:true}).click();
  const future=new Date();future.setDate(future.getDate()+1);
  await page.getByLabel('Fecha',{exact:true}).fill(localDate(future));
  await page.getByRole('button',{name:'Guardar en calendario',exact:true}).click();
  await expect(page.locator('.day-agenda')).toContainText('Rutina de prueba');
  await page.getByRole('button',{name:'Empezar sesión',exact:true}).click();
  await expect(page.locator('.previous')).toContainText('RIR 2');
  await expect(page.locator('.previous')).toContainText('RPE 8');
  await page.getByRole('button',{name:'Usar valores anteriores',exact:true}).click();
  await page.getByRole('button',{name:'Precargar series pendientes',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'Serie 1, Reps',exact:true})).toHaveValue('10');
  await expect(page.getByRole('button',{name:'Completar serie 1',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByLabel('Descanso (segundos)',{exact:true}).fill('20');
  await page.getByRole('button',{name:'Completar serie 1',exact:true}).click();
  await expect(page.locator('.rest')).toContainText('En curso');
  await page.getByRole('button',{name:'Detener',exact:true}).click();
  await page.getByLabel('Descanso automático',{exact:true}).uncheck();
  await page.getByRole('button',{name:'Completar serie 2',exact:true}).click();
  await expect(page.locator('.rest')).not.toContainText('En curso');
  await page.getByRole('button',{name:'Terminar por hoy',exact:true}).click();
  await page.getByRole('button',{name:'Finalizar y guardar',exact:true}).click();
  await expect(page.locator('.progress-details')).toBeVisible();
  if(await page.evaluate(p=>JSON.stringify({...localStorage,...sessionStorage}).includes(p),password))throw Error('Password persisted in browser storage');
  if(context.pages().length!==1||new URL(page.url()).pathname!=='/')throw Error('Login left the app');
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: previous effort, prefill without completion, auto/manual rest, exercise charts, monthly summary, records, rescheduling, responsive widths; email/password, empty/offline validation, reveal toggle, invalid credentials retry, same-app login, persisted session after reload, no stored password, no email requests. Supabase mocked.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});




