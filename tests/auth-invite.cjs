const { chromium, expect } = require('@playwright/test');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const context = await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  const page = await context.newPage(); const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  const id='11234567-89ab-4def-8123-456789abcdef';
  const user={id,email:'invited@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
  const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.signature';
  let changes=0; const remote=new Map();
  await page.route('https://*.supabase.co/**', async route=>{
   const req=route.request(), url=req.url();
   if(url.includes('/auth/v1/user')) {
    if(req.method()==='PUT'){ const body=req.postDataJSON(); if(body.password!=='invited-password-123')throw Error('Unexpected password'); changes++; }
    return route.fulfill({json:user});
   }
   if(url.includes('/auth/v1/logout'))return route.fulfill({status:204});
   if(url.includes('/rest/v1/training_records'))return route.fulfill({json:[...remote.values()]});
   if(url.includes('/rest/v1/rpc/apply_training_record')){const d=req.postDataJSON();const record={id:d.record_id,kind:d.record_kind,data:d.record_data,revision:d.expected_revision+1,deleted:d.is_deleted};remote.set(record.id,record);return route.fulfill({json:{ok:true,record}});}
   throw Error('Unexpected request '+url);
  });
  await page.goto((process.env.TEST_URL||'http://localhost:3002')+'/#access_token='+jwt+'&refresh_token=fake-refresh&expires_in=3600&token_type=bearer&type=invite');
  await expect(page.getByRole('heading',{name:'Elegí tu contraseña'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Cuenta y ajustes'})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Elegí tu contraseña'})).toBeVisible();
  await page.getByLabel('Nueva contraseña',{exact:true}).fill('invited-password-123');
  await page.getByLabel('Repetir contraseña',{exact:true}).fill('mismatch-password');
  await page.getByRole('button',{name:'Guardar contraseña'}).click();
  await expect(page.locator('.error')).toContainText('no coinciden');
  if(changes)throw Error('Mismatch submitted');
  await page.getByLabel('Repetir contraseña',{exact:true}).fill('invited-password-123');
  await page.getByRole('button',{name:'Guardar contraseña'}).click();
  await page.getByRole('button',{name:'Cuenta y ajustes'}).click();
  await expect(page.locator('.account-email')).toHaveText(user.email);
  await expect(page.getByRole('button',{name:'Sincronizar ahora'})).toBeEnabled();
  await expect(page.locator('.notice strong')).toHaveText('Sincronizado');
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await expect(page.getByRole('button',{name:'Iniciar sesión',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Cuenta y ajustes'})).toHaveCount(0);
  if(changes!==1 || errors.length)throw Error(JSON.stringify({changes,errors}));
  console.log('PASS: invitation session, setup survives reload, password confirmation, authenticated app, logout hides app. Supabase mocked.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});


