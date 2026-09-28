const { chromium, expect } = require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const email='password-test@example.test', password='  simulated-password-42  '; let attempts=0;const remote=new Map();
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
  await page.locator('input[name=password]').fill(password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.getByRole('button',{name:'Usar plantillas de calistenia',exact:true}).click();await page.getByRole('button',{name:'Cuenta y ajustes'}).click();await expect(page.locator('.account-email')).toHaveText(email);
  await page.reload();await page.getByRole('button',{name:'Cuenta y ajustes'}).click();await expect(page.locator('.account-email')).toHaveText(email);
  if(await page.evaluate(p=>JSON.stringify({...localStorage,...sessionStorage}).includes(p),password))throw Error('Password persisted in browser storage');
  if(context.pages().length!==1||new URL(page.url()).pathname!=='/')throw Error('Login left the app');
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: email/password, empty/offline validation, reveal toggle, invalid credentials retry, same-app login, persisted session after reload, no stored password, no email requests. Supabase mocked.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});


