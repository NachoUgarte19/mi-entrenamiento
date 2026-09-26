# Mi entrenamiento

App personal para iPhone y PC. Next.js + TypeScript, Tailwind, componentes basados en shadcn/Radix, Dexie y Supabase. Conserva las tres rutinas proporcionadas y sus indicaciones. El descanso de 90 segundos es un valor inicial editable donde no se indicó uno.

## Ejecutar

Requiere Node.js 20.9 o superior.

```sh
npm install
npm run dev
```

Para probar instalación y uso sin conexión:

```sh
npm run build
npm start
```

Abrir http://localhost:3000. `out/` contiene la aplicación estática. El service worker solo se registra en producción. En iPhone, se necesita un dominio HTTPS para instalarla y usar el almacenamiento sin conexión; la IP local por HTTP no equivale a esa prueba.

## Guardado y alcance

- Sin configuración, funciona en modo dispositivo. Los datos viven en IndexedDB de este navegador; no se sincronizan a otro equipo. Exportar un respaldo JSON desde Cuenta y respaldo.
- Rutinas y ejercicios editables, calendario, sesiones libres, registro de series con kilos/tiempo/repeticiones, RIR/RPE opcionales, temporizador, historial y conteos básicos.
- La sesión guarda una copia de la rutina y ejercicios. Editar la biblioteca no cambia los entrenamientos anteriores.
- Las sesiones en curso se recuperan al abrir. Cada edición se escribe inmediatamente en una transacción local. Se informa si el guardado falla.
- La biblioteca diferencia cargas totales, por mancuerna, lastre añadido y asistencia. Para calistenia sin lastre, indicar 0 en lastre. No se estima peso corporal ni tonelaje.
- Circuitos: los ejercicios comparten etiqueta y se puede alternar con el selector; no hay avance automático por rondas.
- Importación del Excel anual, medidas corporales y gráficos avanzados quedan para la siguiente etapa acordada.

## Activar Supabase

1. Crear un proyecto en Supabase. Ejecutar `supabase/schema.sql` en SQL Editor.
2. Copiar `.env.example` a `.env.local`. Completar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con la URL y clave pública del proyecto. Nunca usar la clave service_role.
3. En Authentication, crear el usuario personal con correo confirmado y una contraseña propia. Desactivar nuevos registros públicos. La app solo inicia sesión en cuentas existentes.
4. En Authentication → URL Configuration, configurar la URL de la app y las URLs de redirección permitidas (incluyendo localhost para desarrollo).
5. Reiniciar o reconstruir la app. En Cuenta y respaldo, ingresar correo y contraseña. El acceso sucede dentro de la app instalada: no requiere códigos, redirecciones, SMTP ni modificar plantillas de correo. La contraseña no se guarda por la app; Supabase persiste la sesión en ese navegador o app instalada.
6. Para llevar datos del modo dispositivo a la cuenta, usar “Importar datos guardados sin cuenta”. La pantalla confirma cuántos registros se van a agregar o reemplazar.

Las tablas tienen RLS: cada cuenta solo accede a sus filas. No hace falta un backend con claves privilegiadas. El esquema usa registros JSON validados en la aplicación para conservar versiones y snapshots; el servidor también verifica identidad, tipo y revisión.

### Sincronización

La app usa una cola persistente en IndexedDB. Envía por registro con una revisión esperada y un identificador de mutación. Un reintento de una operación ya confirmada es idempotente. Una edición mientras se envía una versión anterior sigue pendiente. Los borrados son tombstones para no resucitar registros en otro dispositivo.

Si dos dispositivos editaron el mismo registro, ambas versiones se mantienen localmente hasta que se elija una en Cuenta y respaldo. No se fusionan series automáticamente. Sincroniza al guardar, recuperar conexión, volver al primer plano y cada 30 segundos mientras está abierta. No depende de ejecución en segundo plano de iOS. No ofrece edición simultánea de la misma sesión entre pestañas; usar una sola pestaña de registro a la vez.

## Publicar en Vercel

Importar este repositorio en Vercel, elegir Next.js, ejecutar `npm run build` y publicar la salida estática `out`. Configurar las dos variables públicas de Supabase antes de compilar. Se incluye `vercel.json` con salida estática y encabezados del service worker. Después agregar el dominio HTTPS en las redirecciones de Supabase. Requiere una cuenta/proyecto Vercel; no se crea ni despliega automáticamente desde este repositorio.

## Verificación

```sh
npm run typecheck
npm test
npm run build
npm start
```

Las pruebas de navegador usan Playwright con Edge instalado: `node tests/browser.cjs`. Ejecutar contra la aplicación de producción en localhost:3000. Los datos de prueba se guardan solo en contextos aislados del navegador.

Pendiente de validación con servicios reales: creación/invitación de cuenta, RLS y sincronización en dos dispositivos con un proyecto Supabase configurado. También debe verificarse instalación y recuperación de red en un iPhone físico.

