function phrases(lines) {
  return Object.fromEntries(lines.trim().split('\n').map(line => {
    const [intent, ...examples] = line.split('|');
    return [intent, examples];
  }));
}

const train = phrases(`
trafico|me llegan bots y se cae la pagina|el servidor se queda sin respuesta con tantas conexiones|recibo miles de peticiones automatizadas|el sitio se pone lento cuando se conecta mucha gente|me saturaron la web con trafico|suben las solicitudes y aparecen errores 503|la pagina se tumba por un pico de visitas|tengo una avalancha ddos|robots de madrugada tiran mi sitio|se dispara el numero de conexiones simultaneas|hay picos de trafico y el sitio no responde|como mitigo ataques de denegacion de servicio
red|el envio de datos alcanza el limite de ancho de banda|mi hosting llega a su cuota de red|los megabits de salida estan al maximo|mi sitio consume demasiados mbps|la transferencia mensual esta al tope|creo que se agoto la capacidad del enlace|el proveedor corta por exceso de ancho de banda|como reviso trafico de entrada y salida|la cuota de transferencia del plan es baja|creo que el cuello de botella es el ancho de banda
rendimiento|mi pagina carga demasiado lento|el portal demora segundos en abrir|la red no se satura pero todo demora|que mido para saber por que la web tarda|la latencia del inicio de sesion sube|la cpu no esta llena pero la aplicacion va lenta|se demora una consulta del servidor|mi panel tarda en responder sin tanto trafico|quiero medir el tiempo de respuesta|la carga de una ruta se queda esperando
acceso|alguien se metio a mi pc|veo un inicio de sesion que no reconozco|cambiaron los datos de contacto sin permiso|alguien entro con mi cuenta|aparecio una sesion desconocida en el servidor|hubo un acceso inesperado al panel|hay modificaciones que nadie del equipo hizo|me llego una alerta de acceso desde otra ciudad|creo que alguien accede a mi computador|veo accesos sospechosos en el historial|como reviso quien edito un registro sin permiso
datos|me preocupa una filtracion de datos|alguien pudo robar los datos de mis usuarios|como protejo la informacion de mis clientes|quien puede exportar datos personales|hay datos de clientes publicados sin permiso|creo que copiaron los registros de mis usuarios|necesito asegurar la informacion personal|que hago si se exponen datos de clientes|como limito la lectura de datos sensibles|pueden descargar datos privados que no les corresponden
despliegue|despues de publicar se rompe el login|el ultimo despliegue dejo el sitio con errores|como automatizar pruebas antes de lanzar cambios|que incluye la implementacion de pipeline|quiero configurar github actions para ci cd|como evitar fallos al desplegar versiones|cada actualizacion rompe algun formulario|mi produccion fallo luego de subir una version|quiero agregar controles devsecops al pipeline|necesito que el despliegue pare si fallan las pruebas
mongodb|que incluye el hardening de mongodb atlas|quiero configurar permisos minimos en mongo|necesito indices para mis consultas nosql|como mejoro la configuracion de mongodb|que cubre la administracion de atlas|como se validan documentos con mongoose|necesito reforzar mi base de datos mongo|que backups recomiendan para mongodb atlas|quiero revisar roles de acceso de mi base nosql|que significa hardening
auditoria|quiero auditar la seguridad de mi api|que incluye el pentesting de una web|necesito un reporte de vulnerabilidades|hacen pruebas owasp en aplicaciones|pueden evaluar los permisos de mi portal|necesito revisar jwt y controles de acceso|que herramientas usan en una auditoria|quiero una evaluacion de seguridad web|que revisa una prueba de penetracion|quiero revisar mis cabeceras de seguridad
precios|cuanto vale|cuanto cuesta mongodb atlas|lista de precios|que servicios ofrecen y a que precios|que cobran por un pentesting|cuantas uf sale un pipeline|quiero cotizar la mitigacion ddos|cuales son las tarifas|muestrame el catalogo de servicios|que productos tienen|precio de auditoria owasp|cuanto cuesta el envio
reserva|como reservo una auditoria|como puedo agendar un servicio|donde veo mis solicitudes|mi reserva esta pendiente|ya aprobaron mi solicitud|quiero pedir hora para el servicio|como solicito una fecha|estado de mi reserva|puedo reservar una consultoria|a donde voy para hacer una reserva
contacto|quiero hablar con un ejecutivo|donde esta el formulario de contacto|puedo conversar con una persona|no me llega el correo de confirmacion|como contacto al equipo|quiero que me contacten|necesito ayuda de un especialista|a que correo escribo|no recibi el acuse|como solicito asistencia humana
ayuda|quien eres|hola|que es aegissec|que puedo preguntar|buenos dias|a quien va dirigido|como funcionas|que sabes hacer|me puedes ayudar con una consulta|gracias por la informacion
fuera|quiero jugar gta|dame una receta de pan|que hora es|recomiendame una pelicula|cuentame un chiste|explica la biblia|resultado del futbol|dame nombres para un canal|cual es el clima|escribe una cancion|quiero comprar un auto
`);

const test = phrases(`
trafico|el sitio claudica ante visitas simultaneas|un enjambre de robots ahoga el portal|las peticiones se multiplican y la web queda inutilizable|sobrecarga por visitantes en masa
red|el caudal saliente roza el techo contratado|se llena el enlace de datos cuando mando archivos|mi proveedor limita los mbps del servidor|podria estar agotando el ancho de banda
rendimiento|la pantalla responde con mucho retraso|necesito investigar tiempos de carga altos|el inicio de sesion sigue lento aunque la red va bien|la aplicacion tiene latencia elevada sin picos
acceso|encontre una sesion iniciada por desconocidos|personas ajenas entraron a mi servidor|los cambios del perfil no son nuestros|mostro un acceso que no puedo atribuir
datos|sospecho que alguien extrajo informacion personal|evitar que terceros se lleven datos de usuarios|se hicieron publicos registros de clientes|quiero prevenir fugas de informacion
despliegue|al pasar a produccion dejo de funcionar el formulario|necesito un pipeline que detenga una mala version|cada vez que saco un release aparece un error|quiero pruebas automaticas para publicar cambios
mongodb|reforzar roles de mi cluster atlas|revisen mis permisos e indices nosql|servicio para asegurar un cluster mongo|quiero endurecer la configuracion de mi base
auditoria|evaluen las debilidades de mi sitio|revision owasp de mi interfaz y api|busco un pentest profesional|validar la seguridad del portal antes de abrirlo
precios|en cuanto me sale asegurar atlas|muestrame las tarifas vigentes|que valor tiene una revision web|quiero saber los precios de los productos
reserva|donde pido una cita|dime si autorizaron mi reserva|quiero escoger un dia para la auditoria|donde consulto el estado de la solicitud
contacto|me gustaria conversar con alguien del equipo|no encontre la confirmacion en mi correo|como le escribo a soporte|necesito escalar el caso con una persona
ayuda|buenas tardes|eres aegisbot|sobre que temas me orientas|como me ayudas
fuera|sugiere una serie para ver|dame una receta de lentejas|quien gano el partido|quiero instalar un videojuego
`);

const extra = phrases(`
trafico|el portal colapsa bajo trafico en masa|las visitas simultaneas tumban el servicio|hay sobrecarga de conexiones concurrentes|pico de robots satura la aplicacion|la avalancha de solicitudes tumba todo el sitio
red|el limite de transferencia saliente se alcanza en el pico|mi enlace se satura al enviar ficheros|el caudal de red toca el limite contratado|la salida de datos supera el tope del plan|el ancho de banda marca cien por ciento
rendimiento|la pantalla tarda en actualizarse|el tiempo de carga de las paginas aumento|latencia alta en el navegador|mi login demora aunque la red funciona bien|la interfaz responde con retraso fuera de horas punta
acceso|personas ajenas ingresaron al servidor|el historial muestra una conexion que no es mia|alguien cambio mi perfil y no se quien|el registro no indica de quien fue el acceso|vi una cuenta desconocida en mi computador
datos|necesito prevenir fugas de informacion privada|podrian haber extraido datos personales|quiero proteger la privacidad de mis usuarios|hay una fuga de registros privados|como evito que extraigan informacion de los clientes
despliegue|al llevar un cambio a produccion sale error|el formulario falla despues de un release|quiero parar despliegues si una prueba falla|agrega pruebas automaticas a la publicacion del portal|desde que publique la nueva compilacion el sistema se cae
mongodb|asegurar un cluster de mongo|configurar indices y usuarios de mi base atlas|endurecer la configuracion de una base mongodb|dar permisos distintos en la base nosql|revisar seguridad de un cluster atlas de mongodb
auditoria|busco un pentest para mi interfaz|evaluen las debilidades de la aplicacion|quiero probar controles de seguridad de mi sitio|pueden revisar mi api segun owasp|quiero validar antes de publicar las vulnerabilidades del portal
precios|en cuanto sale el servicio|que valor tiene la auditoria|cuantas uf cuesta la revision web|necesito las tarifas vigentes de la consultoria|a que precio ofrecen reforzar la base de datos
reserva|me gustaria elegir un dia para la consultoria|quiero reservar una cita para el pentest|donde consulto si aprobaron mi solicitud|como pido una cita con fecha preferida|en que seccion veo el estado de una cita
contacto|necesito comunicarme con soporte|como le escribo a un miembro del equipo|el acuse por correo no aparecio|puedo hablar con alguien que me atienda|necesito derivar la consulta a un humano
ayuda|como puedes ayudarme|en que temas me puedes orientar|hola buenas tardes|eres el asistente aegisbot|me explicas como funciona este chat
fuera|recomienda series para ver|quien gano el partido de anoche|como instalo un juego en mi consola|busco una receta de cocina|que resultado tuvo el partido de futbol
`);
for (const [intent, examples] of Object.entries(extra)) train[intent].push(...examples);

const final = phrases(`
trafico|oleadas de peticiones tumban la web|se cae el portal cuando hay demasiadas conexiones
red|en el panel veo saturada la transferencia de salida|el hosting reporta que alcance el tope de mbps
rendimiento|el sitio tarda demasiado en mostrar el panel|las respuestas del backend tienen latencia elevada
acceso|veo una cuenta que no conozco en el historial de sesiones|alguien modifico mi ficha sin que yo lo autorizara
datos|terceros se llevaron informacion de mis clientes|necesito evitar una exposicion de datos personales
despliegue|publique un cambio y desde entonces hay fallos|quiero que las pruebas bloqueen la salida a produccion
mongodb|como limitar los roles del cluster de mongodb|necesito respaldar una base atlas
auditoria|quiero que analicen los riesgos de mi aplicacion antes de publicarla|que pruebas hacen para una auditoria web
precios|diganme el valor del servicio de seguridad|cuanto vale la consultoria para atlas
reserva|en que parte reviso si mi solicitud sigue pendiente|puedo agendar una fecha para la consultoria
contacto|como consigo que me atienda un ejecutivo|no veo el mail de confirmacion que me enviaron
ayuda|hola que tal|como se llama el asistente
fuera|quiero aprender a preparar empanadas|me recomiendas un videojuego de carreras
`);

module.exports = { train, test, final };
