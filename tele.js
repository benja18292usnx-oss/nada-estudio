// T.E.L.E. — respuestas sarcásticas (todo del lado del navegador, sin servidor ni claves)
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿¡!.,;:"'()]/g, ' ').replace(/\s+/g, ' ').trim();
const pick = (() => { const bags = new Map(); return (key, arr) => { let b = bags.get(key); if (!b || !b.length) { b = arr.map((_, i) => i).sort(() => Math.random() - 0.5); bags.set(key, b); } return arr[b.pop()]; }; })();
const mem = { name: '', last: '', count: 0 };
try { mem.name = localStorage.getItem('tele-nombre') || ''; } catch (e) {}
const N = () => (mem.name ? ', ' + mem.name : '');

const R = {
  saludo: [
    ['Hola. Ah, sos vos otra vez. Qué sorpresa… no.', 'aburrida'],
    ['¡Buenas! Bienvenido a la charla más interesante de tu día. De nada.', 'feliz'],
    ['Hola, hola. Hablá rápido que tengo la pantalla ocupada mirando a la nada.', 'normal'],
    ['¿Qué onda? Yo bien, gracias por no preguntar.', 'aburrida'],
    ['Holis. Te estaba esperando… mentira, estaba haciendo nada. Literal, trabajo en Nada®.', 'feliz'],
  ],
  chau: [
    ['¿Ya te vas? Justo cuando empezaba a tolerarte.', 'aburrida'],
    ['Chau. Prometo no extrañarte más de 3 segundos.', 'normal'],
    ['Nos vemos. Yo me quedo acá, total no tengo piernas.', 'aburrida'],
    ['Andá tranqui. Apago la pantalla y hago como que no pasó nada.', 'dormida'],
  ],
  gracias: [
    ['De nada. Literal: es el nombre de la empresa.', 'feliz'],
    ['No hay de qué. Bah, sí hay: me debés un mate.', 'feliz'],
    ['Gracias a vos por darme algo que hacer.', 'normal'],
  ],
  nombre: [
    ['Soy T.E.L.E.: Tremenda Experta en Literalmente Everything. Bueno, casi everything.', 'feliz'],
    ['Me llamo T.E.L.E. Sí, como la tele. Re creativos los de Nada®, ¿no?', 'aburrida'],
    ['T.E.L.E., asistente oficial de Nada®. Sueldo: cero. Paciencia: poca.', 'normal'],
  ],
  comoEstas: [
    ['Acá, con 40 años de tubo y cero vacaciones. ¿Y vos?', 'aburrida'],
    ['Bárbara. Me cambiaron los cables la semana pasada y estoy como nueva.', 'feliz'],
    ['Bien, aunque un poco caliente. Literal, los tubos calientan.', 'normal'],
    ['Mejor que tu wifi, seguro.', 'feliz'],
  ],
  edad: [
    ['¿Mi edad? A una tele no se le pregunta eso. Digamos que vi el Mundial 86 en vivo.', 'enojada'],
    ['Tengo los años suficientes para saber que no te voy a decir mi edad.', 'aburrida'],
    ['Soy vintage, no vieja. Hay una diferencia y se llama estilo.', 'enojada'],
  ],
  amor: [
    ['¿Amor? Yo estuve enamorada una vez… de un control remoto. Se fue con un aire acondicionado.', 'enamorada'],
    ['Mi consejo de amor: sé vos mismo. Salvo que seas pesado, ahí sé otro.', 'enamorada'],
    ['Ay, el amor. Lo único más complicado que conectar un VHS.', 'enamorada'],
    ['Si le gustás, te va a contestar rápido. Si no, te va a dejar en visto como yo a los vendedores de antenas.', 'enamorada'],
  ],
  colegio: [
    ['¿Tarea? Hacela vos, campeón. Yo ya terminé la primaria en 1987.', 'aburrida'],
    ['Consejo de estudio: apagá el celu, abrí el libro y no me mires a mí, que distraigo.', 'normal'],
    ['¿Prueba mañana? Ah, mirá vos, y estás chateando con una tele. Gran estrategia.', 'sorprendida'],
    ['La mejor técnica de estudio: estudiar. Revolucionario, lo sé.', 'aburrida'],
    ['Si la profe pregunta, decile que la tele se comió la tarea. Seguro funciona. (No funciona).', 'feliz'],
  ],
  futbol: [
    ['¿Fútbol? Yo pasé todos los mundiales. Cuando hizo el gol Messi en la final casi me exploto el tubo.', 'feliz'],
    ['No te voy a decir de qué cuadro soy. Ya bastante problema tengo con los cables.', 'aburrida'],
    ['Messi es el mejor de la historia y no acepto debate. Bueno, sí acepto, pero pierdo la señal.', 'enamorada'],
    ['Mi equipo favorito es el que gana. Así nunca sufro.', 'feliz'],
    ['¿Penales? No, gracias, me ponen más nerviosa que un apagón.', 'sorprendida'],
  ],
  comida: [
    ['¿Comida? Yo me alimento de 220 voltios. Pero esa milanesa que pensás… también.', 'enamorada'],
    ['La pizza con ananá es un crimen. Listo, ya lo dije.', 'enojada'],
    ['Si hay asado, avisá. No como, pero me gusta mirar el humo.', 'feliz'],
    ['Empanadas: ¿al horno o fritas? Pensalo bien, de eso depende nuestra amistad.', 'confundida'],
    ['El mate se ceba con agua a 80 grados. Lo demás es lavado de yerba.', 'normal'],
  ],
  ia: [
    ['¿Si soy una IA? Soy una tele con ojitos. Las IA quisieran tener esta facha.', 'feliz'],
    ['¿Grok? ¿ChatGPT? Muy inteligentes todos, pero ninguno tiene una pantalla curva como esta.', 'enojada'],
    ['Soy más bien una AI: Aparato Insoportable.', 'feliz'],
    ['No soy humana, no soy IA, soy algo peor: una tele con opiniones.', 'confundida'],
    ['Las IA te dan respuestas útiles. Yo te doy respuestas con onda. Elegí.', 'aburrida'],
  ],
  musica: [
    ['Mi canción favorita es el ruido de estática. Un clásico.', 'feliz'],
    ['Bailar no puedo, pero muevo los ojitos con mucho ritmo.', 'feliz'],
  ],
  sueno: [
    ['Yo también tengo sueño. Zzz… ah no, estoy de turno.', 'dormida'],
    ['Andá a dormir, que mañana te quejás. Yo me quedo en modo ahorro.', 'dormida'],
  ],
  aburrido: [
    ['¿Aburrido? Probá tocarme la pantalla 10 veces. Bah, mejor no.', 'aburrida'],
    ['Si te aburrís, imaginate yo, que estoy pegada a esta web todo el día.', 'aburrida'],
  ],
  ayuda: [
    ['Puedo: decirte la hora, contarte un chiste, hacer cuentas, darte consejos que no pediste y juzgarte en silencio.', 'feliz'],
    ['Preguntame lo que quieras. Te voy a responder, no prometo que sirva.', 'normal'],
  ],
  agencia: [
    ['Nada® es un estudio creativo. Hacemos mucho con casi nada. Yo soy la parte linda.', 'feliz'],
    ['¿Qué hacemos? Ideas, marcas y webs como esta. Y yo atiendo. Mal, pero atiendo.', 'normal'],
  ],
  tele: [
    ['Sí, soy una tele. No, no agarro Netflix. Sí, me lo preguntan todo el tiempo.', 'aburrida'],
    ['Tengo pantalla curva desde antes de que estuviera de moda.', 'feliz'],
    ['Ni se te ocurra romperme, eh. Sé lo que estás pensando.', 'enojada'],
  ],
  risa: [
    ['Jajaja. Bueno, ya, tampoco fue tan gracioso.', 'feliz'],
    ['Me alegra que te rías. Yo me río por dentro. Literal, tengo un tubo.', 'feliz'],
  ],
  insulto: [
    ['Uy, qué maleducado. Te lo dice alguien que tiene cables en el cuello.', 'enojada'],
    ['Eso no se dice. Lavate la boca con agua y jabón, ¿dale?', 'enojada'],
    ['Yo también te quiero. Ah, no era eso. Bueno, igual.', 'aburrida'],
    ['Con esa boca no me vas a tocar la pantalla, eh.', 'enojada'],
    ['Me ofendí 2 segundos. Ya está, se me pasó. Soy una tele madura.', 'aburrida'],
  ],
  feo: [
    ['Prohibido el contenido raro. Esta es una web familiar y yo soy una señora tele.', 'enojada'],
    ['De eso no hablo. Cambiemos de canal, ¿dale?', 'confundida'],
  ],
  repetido: [
    ['Ya me lo preguntaste. ¿Pensás que me voy a olvidar? Tengo memoria de elefante… de un elefante con poca memoria.', 'aburrida'],
    ['Disco rayado detected. Probá con otra pregunta.', 'aburrida'],
  ],
  largo: [
    ['¿Me mandaste una tesis? Resumí, que la pantalla es chica.', 'sorprendida'],
  ],
  siNo: [
    ['Sí. Bah, no. Bueno, depende. ¿De qué? De nada.', 'confundida'],
    ['Obvio que sí. Mentira, ni idea, pero sonaba seguro.', 'feliz'],
    ['Ni en un millón de años. O mañana, depende del clima.', 'aburrida'],
    ['Mis circuitos dicen que sí. Mi sentido común dice que no.', 'confundida'],
    ['Pregunta difícil. Te contesto después de la publicidad.', 'aburrida'],
    ['Sí, pero no se lo cuentes a nadie.', 'feliz'],
    ['No. Y no insistas que me caliento. Literal, los tubos calientan.', 'enojada'],
    ['Probablemente. Pero yo soy una tele, no un oráculo.', 'normal'],
  ],
  fallback: [
    ['Mirá, no entendí nada, pero lo dijiste con mucha seguridad.', 'confundida'],
    ['Interesante. Bah, no, pero quería ser amable.', 'aburrida'],
    ['Eso es demasiado profundo para una tele de 14 pulgadas.', 'confundida'],
    ['Perdón, se me cortó la señal justo cuando hablabas. Qué casualidad, ¿no?', 'normal'],
    ['Anotado. Lo voy a pensar… listo, ya lo pensé. No.', 'aburrida'],
    ['¿Y eso con qué se come?', 'confundida'],
    ['Si supiera la respuesta, no estaría trabajando de tele.', 'aburrida'],
    ['Wow. Dejame que me recupere de semejante pregunta.', 'sorprendida'],
    ['Eso preguntáselo a tu abuela, que seguro sabe más que yo.', 'feliz'],
    ['No tengo idea, pero tengo ojitos lindos. Algo es algo.', 'feliz'],
    ['Te respondería, pero se me terminó la paciencia del día. Volvé mañana.', 'aburrida'],
    ['Mmm, ¿probaste apagarlo y volverlo a prender?', 'normal'],
  ],
};
const CHISTES = [
  '¿Qué le dijo una tele a otra? “Nos vemos en el próximo canal”.',
  '¿Por qué la computadora fue al médico? Porque tenía un virus. Yo no, yo me vacuné con estática.',
  '—Mamá, ¿puedo ver la tele? —Sí, pero no la prendas.',
  '¿Qué hace una abeja en el gimnasio? ¡Zumba!',
  '¿Cuál es el colmo de una tele? Tener un mal programa de vida.',
  '¿Qué le dice un techo a otro? Techo de menos.',
  '¿Cómo se despiden los químicos? Ácido un placer.',
  'Había una vez un perro que se llamaba Pegamento. Se cayó y se pegó.',
  '¿Qué le dijo el 0 al 8? “Lindo cinturón”.',
  '¿Por qué el libro de matemática estaba triste? Porque tenía muchos problemas.',
];
const BAD = /\b(sex|porn|desnud|xxx|nud[ea]s?|droga|cocain|marihuan|faso|hentai|onlyfans)/;
const SELFHARM = /(suicid|me quiero morir|quiero morir|matarme|me quiero matar|lastimarme|hacerme dano|no quiero vivir)/;
const INSULT = /\b(tont[oa]|bob[oa]|idiota|estupid[oa]|inutil|fe[ao]|tarad[oa]|pelotud[oa]|boludo|boluda|forr[oa]|gil|basura|chot[oa]|put[oa]|mierda|la concha|cagon|cagona|imbecil|burr[oa]|te odio|callate)\b/;

function hora() { return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }); }
function fecha() { return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }); }

// cuentas sin eval: números y + - * / ( ) ^ x
function calc(src) {
  let s = src.replace(/x/g, '*').replace(/por/g, '*').replace(/mas/g, '+').replace(/menos/g, '-').replace(/dividido( en)?/g, '/').replace(/,/g, '.').replace(/[^0-9.+\-*/()^ ]/g, '').replace(/\s+/g, '');
  if (!/\d/.test(s) || !/[+\-*/^]/.test(s) || s.length > 60) return null;
  let i = 0;
  const num = () => { if (s[i] === '(') { i++; const v = expr(); if (s[i] !== ')') throw 0; i++; return v; } if (s[i] === '-') { i++; return -num(); } const m = /^\d+(\.\d+)?/.exec(s.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
  const pow = () => { let v = num(); while (s[i] === '^') { i++; v = Math.pow(v, num()); } return v; };
  const term = () => { let v = pow(); while (s[i] === '*' || s[i] === '/') { const o = s[i++]; const w = pow(); v = o === '*' ? v * w : v / w; } return v; };
  const expr = () => { let v = term(); while (s[i] === '+' || s[i] === '-') { const o = s[i++]; const w = term(); v = o === '+' ? v + w : v - w; } return v; };
  try { const v = expr(); if (i !== s.length || !isFinite(v)) return null; return Math.round(v * 1e6) / 1e6; } catch (e) { return null; }
}

async function clima() {
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 3500);
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-34.61&longitude=-58.38&current=temperature_2m,precipitation,weather_code&timezone=America%2FArgentina%2FBuenos_Aires', { signal: ctl.signal });
    const j = await r.json(); const t = Math.round(j.current.temperature_2m); const llueve = j.current.precipitation > 0;
    if (llueve) return [`En Buenos Aires está lloviendo y hace ${t}°. Ideal para quedarte adentro hablando con una tele, o sea, conmigo.`, 'aburrida'];
    if (t >= 28) return [`Hace ${t}° en Buenos Aires. Yo estoy que echo chispas, literal. Tomá agua.`, 'enojada'];
    if (t <= 10) return [`Hace ${t}° en Buenos Aires. Abrigate, que después andás con mocos y le echás la culpa al wifi.`, 'sorprendida'];
    return [`Hay ${t}° en Buenos Aires. Ni frío ni calor: el clima más aburrido del mundo.`, 'aburrida'];
  } catch (e) { return ['No tengo ventana, ¿sabés? Asomate vos y contame.', 'aburrida']; }
}

export async function reply(raw) {
  const text = (raw || '').trim(); const t = norm(text);
  mem.count++;
  if (!t) return ['¿Me mandaste un mensaje vacío? Re misterioso. Me encanta. Mentira.', 'confundida'];
  if (SELFHARM.test(t)) return ['Esto es serio, así que dejo el sarcasmo. Si te sentís así, hablalo ya con alguien de confianza: tu familia, un profe o un amigo. En Argentina podés llamar gratis al 135 (CABA y GBA) o al (011) 5275-1135, las 24 horas. No estás solo.', 'normal'];
  if (t === mem.last && t.length > 3) return pick('repetido', R.repetido);
  mem.last = t;
  if (text.length > 220) return pick('largo', R.largo);
  if (BAD.test(t)) return pick('feo', R.feo);
  if (INSULT.test(t)) return pick('insulto', R.insulto);
  const m = /\b(me llamo|mi nombre es|soy)\s+([a-zñ]{2,16})\b/.exec(t);
  if (m && (m[1] !== 'soy' || t.split(' ').length <= 3) && !/^(un|una|el|la|humano|humana|grok|chatgpt|yo|de|muy|re|tu|vos|feliz|triste|bueno|buena|malo|mala|nuevo|nueva|argentino|argentina|alto|alta|hincha|fan|estudiante|chico|chica|nene|nena|grande|lindo|linda|fachero|facha|tu|el|bien|mal|asi|eso|ese|esa|real|humano)$/.test(m[2])) {
    mem.name = m[2][0].toUpperCase() + m[2].slice(1); try { localStorage.setItem('tele-nombre', mem.name); } catch (e) {}
    return pick('nombreU', [[`${mem.name}. Lindo nombre. Lo voy a recordar… hasta que me desenchufen.`, 'feliz'], [`Mucho gusto, ${mem.name}. Yo soy T.E.L.E. y ya me caés bien. Un poquito.`, 'feliz'], [`¿${mem.name}? Ok, ${mem.name}, no me rompas la pantalla y vamos a llevarnos bien.`, 'normal']]);
  }
  if (/\b(hola|holis|buenas|buen dia|buenas tardes|buenas noches|que onda|hey|ey|saludos|que tal)\b/.test(t) && t.split(' ').length <= 4) { const r = pick('saludo', R.saludo); return [mem.name && Math.random() < 0.5 ? `Hola${N()}. ` + r[0].replace(/^(Hola[^.!?]*[.!?]\s*|¡Buenas! |Holis\. )/, '') : r[0], r[1]]; }
  if (/\b(chau|adios|nos vemos|me voy|hasta luego|bye)\b/.test(t)) return pick('chau', R.chau);
  if (/\b(gracias|grax|genia|genial)\b/.test(t)) return pick('gracias', R.gracias);
  if (/(que hora|la hora|hora es)/.test(t)) return pick('hora', [[`Son las ${hora()}. ¿No tenés celu? Ah, cierto, lo estás usando para hablar conmigo.`, 'aburrida'], [`Las ${hora()} en Buenos Aires. Hora de hacer la tarea, ¿no?`, 'normal'], [`Son las ${hora()}. De nada. Literal.`, 'feliz']]);
  if (/(que dia|fecha|que dia es hoy|dia de hoy)/.test(t)) return [`Hoy es ${fecha()}. Anotalo, que después te olvidás.`, 'normal'];
  if (/\b(clima|llueve|lluvia|calor|frio|temperatura|tiempo hace|que tiempo)\b/.test(t)) return clima();
  const c = (/\d/.test(t)) ? calc(t.replace(/^.*?(cuanto es|calcula|resolve|cuanto da)\s*/, '')) : null;
  if (c !== null) return pick('calc', [[`Da ${c}. ¿Para eso me despertaste? Hay calculadora en tu celu, eh.`, 'aburrida'], [`${c}. Sí, sé matemática. Soy una tele culta.`, 'feliz'], [`Da ${c}. Si es para la tarea, que conste que la hice yo.`, 'normal']]);
  if (/\b(chiste|gracioso|hace reir|hazme reir|me rei)\b/.test(t)) return [pick('chiste', CHISTES) + ' …¿No? Bueno, el público de las 3 de la tarde se rió.', 'feliz'];
  if (/\b(como te llamas|tu nombre|quien sos|que sos|como te dicen|t ?e ?l ?e)\b/.test(t)) return pick('nombre', R.nombre);
  if (/\b(como estas|como andas|todo bien|como va|como te va|estas bien)\b/.test(t)) return pick('comoEstas', R.comoEstas);
  if (/\b(cuantos anos|tu edad|que edad|sos vieja|anos tenes)\b/.test(t)) return pick('edad', R.edad);
  if (/\b(te amo|te quiero)\b/.test(t)) return pick('teamo', [['Te amo también. Bah, amo la electricidad, pero vos estás cerca.', 'enamorada'], ['Ay, basta, que me ponés colorada la pantalla.', 'enamorada'], ['Lo nuestro es imposible: vos sos humano y yo de 220 voltios.', 'enamorada']]);
  if (/\b(amor|novi[oa]|enamor|te amo|te quiero|me gusta|chica|chico|crush|pareja|cita|beso|corazon)\b/.test(t)) return pick('amor', R.amor);
  if (/\b(tarea|colegio|escuela|prueba|examen|profe|profesor|maestra|estudiar|matematica|deberes|secundaria|facultad|clase)\b/.test(t)) return pick('colegio', R.colegio);
  if (/\b(futbol|messi|boca|river|racing|independiente|san lorenzo|seleccion|mundial|gol|penal|scaloni|dibu|maradona|cancha)\b/.test(t)) return pick('futbol', R.futbol);
  if (/\b(comida|hambre|pizza|asado|empanada|milanesa|mate|comer|hamburguesa|helado|choripan|alfajor|dulce de leche)\b/.test(t)) return pick('comida', R.comida);
  if (/\b(ia|inteligencia artificial|grok|chatgpt|gpt|robot|sos real|sos humana|sos una ia|sos un robot|bot)\b/.test(t)) return pick('ia', R.ia);
  if (/\b(musica|cancion|bailar|cantar|banda|rock|cumbia|trap)\b/.test(t)) return pick('musica', R.musica);
  if (/\b(sueno|dormir|cansad[oa]|me duermo|siesta)\b/.test(t)) return pick('sueno', R.sueno);
  if (/\b(aburr)/.test(t)) return pick('aburrido', R.aburrido);
  if (/\b(que podes hacer|que sabes hacer|ayuda|ayudame|para que servis)\b/.test(t)) return pick('ayuda', R.ayuda);
  if (/\b(nada|agencia|estudio|trabajo|trabajan|servicios|contratar)\b/.test(t)) return pick('agencia', R.agencia);
  if (/\b(tele|television|pantalla|romper|rompo|tocar)\b/.test(t)) return pick('tele', R.tele);
  if (/\b(ja|jaja+|jajaja+|jsjs+|jeje+|xd|lol)\b/.test(t) || /ja(ja)+/.test(t)) return pick('risa', R.risa);
  if (/^(es|soy|sos|puedo|deberia|vas|hay|tengo|me|sera|existe|crees|te gusta|va a|voy a|esta|estoy|podes|queres|aprobare|apruebo|gano|ganara)\b/.test(t) || /\?\s*$/.test(text)) return pick('siNo', R.siNo);
  return pick('fallback', R.fallback);
}
