/* Interface and dialogue language. English or Spanish, picked in the settings sheet (or from the app). */
const S = {
  en: {
    fuel: 'fuel left', fuel_notes: '{n} notes', view: 'View', map: 'Map', done: 'Done', sky_live: 'Live sky', sky_sunset: 'Sunset', sky_night: 'Night',
    view_near: 'Close camera', view_far: 'Far camera', view_bonnet: 'Bonnet camera', view_cockpit: 'Inside the car', view_foot: 'On foot', view_shoulder: 'Over the shoulder', view_first: 'First person',
    left: 'Steer left', right: 'Steer right', gas: 'Gas', brake: 'Brake or reverse', drift: 'Drift',
    map_hint: 'Tap anywhere to close', home: 'Home', hint_keys: 'WASD to drive, Space to drift, F to get out, Q radio, V camera, M map',
    hint_touch: 'Hold the arrows to drive, tap Drift to slide', splash: 'Splash', back_on_road: 'Back on the road', stunt: 'Stunt jump', air: '{s} s in the air',
    note: 'Sticky note', crate: 'Seed crate', crate_sub: 'A free seed for your garden', visit: 'Hi {n}', visit_sub: 'Your visit counts at the end',
    trial_go: 'Go! Follow the rings', medal_gold: 'Gold medal', medal_silver: 'Silver medal', medal_bronze: 'Bronze medal', no_medal: 'Gold is {t}',
    out_of_fuel: 'Out of fuel', drive_over: 'Drive over', study_more: 'Study a bit more to fill the tank again.', fuel_waits: 'The fuel you didn’t use waits for next time.',
    time_driven: 'Time in the city', notes: 'Sticky notes', crates: 'Seed crates', jumps: 'Stunt jumps', visits: 'Friends visited', best_trial: 'Best trial', back: 'Back to the garden',
    loading: 'Loading the city', loading_tex: 'Loading textures', loading_city: 'Building the city', loading_trees: 'Growing trees', loading_props: 'Placing street furniture', loading_cars: 'Filling the streets', loading_light: 'Lighting',
    get_out: 'Get out', get_in: 'Get in', talk: 'Talk', enter: 'Go in', settings: 'Settings', quality: 'Quality', language: 'Language', voices: 'Voices', subtitles: 'Subtitles',
    q_next: 'Changes on your next drive', q_auto: 'Auto', q_low: 'Low', q_medium: 'Medium', q_high: 'High', q_ultra: 'Ultra', on: 'On', off: 'Off', close: 'Close',
    radio_off: 'Radio off', wanted: 'Wanted', busted: 'Busted', wasted: 'Wasted', cash: 'coins',
    back_on_land: 'Back on dry land', slow_down: 'Stop the car first', too_far: 'Your car is too far', find_car: 'Walk up to it and press F',
    place_cafe: 'Café', place_shop: 'Clothing shop', place_garage: 'Garage', place_gym: 'Gym', place_flat: 'Your flat',
    p_leave: 'Go outside', p_coffee: 'Order a coffee', p_shop: 'Look at clothes', p_garage: 'Cars and paint', p_bag: 'Hit the bag (click or J)', p_desk: 'Your desk', p_bed: 'Lie down', p_mirror: 'Mirror', p_ring: 'The ring',
    do_coffee: 'Café con leche', do_coffee_sub: 'On the house today', do_desk: 'Your desk', do_desk_sub: 'Every minute you study in Bloc fills 12 s of fuel', do_bed: 'Five more minutes', do_bed_sub: 'The city waits for you',
    do_mirror: 'Looking good', do_mirror_sub: 'Change clothes at the counter', do_ring: 'The ring opens soon', do_ring_sub: 'Boxing matches come with the fights update', do_bag: 'Jab', do_bag_sub: 'Click or press J to punch',
    slot_top: 'Tops', slot_bottom: 'Bottoms', slot_shoes: 'Shoes', slot_hat: 'Hats', slot_body: 'Body and hair', skin: 'Skin', hair: 'Hair', hair_colour: 'Hair colour', body_free: 'Body and hair changes are free.',
    hair_short: 'Short', hair_buzz: 'Buzz', hair_curly: 'Curly', hair_long: 'Long', hair_bun: 'Bun', hair_none: 'Shaved',
    wearing: 'Wearing', owned: 'Yours', bought: 'Bought: {n}', no_coins: 'Not enough coins yet', need_house: 'Needs a bigger house', try_again: 'That didn’t work. Try again.', cars: 'Cars', paint: 'Paint', driving: 'Driving',
    staff_barista: 'Barista', staff_clerk: 'Shop assistant', staff_mechanic: 'Mechanic', staff_coach: 'Coach',
    job_courier: 'Courier job', job_taxi: 'Taxi job', job_errand: 'Errand on foot', job_go: 'Get to the red marker', job_done: 'Job done: +{n} coins at the end', job_late: 'Too slow, the job is off', need_car: 'This one needs a car', need_foot: 'This one is on foot', passenger: 'Passenger', customer: 'Customer', jobs: 'Jobs', repair: 'Repair the car', repair_sub: 'Free, dents and smoke gone', repaired: 'Good as new', plane: 'Flight school plane', fly: 'Fly the plane', plane_keys: 'W and S power, arrows to climb and dive, A and D to turn, F to get out once landed', plane_touch: 'Up and down to climb, left and right to turn, Drift for more power', land_first: 'Land and stop first', crash: 'Crash landing', crash_sub: 'The plane is back at the airport', lost_them: 'Lost them', lost_them_sub: 'The police gave up', busted_sub: 'A warning this time, no coins lost', officer: 'Officer', driver: 'Driver', ko: 'Knocked out', ko_sub: 'You wake up a moment later. No coins lost.', web_only: 'Fighting is on the website only', bout: 'Sparring', bout_sub: 'Land five punches first. Click or J to punch.', bout_won: 'You won the bout', bout_won_sub: 'The coach is impressed', bout_lost: 'Down you go', bout_lost_sub: 'Get up and try again', sparring: 'Sparring partner', radio: 'Radio'
  },
  es: {
    fuel: 'gasolina', fuel_notes: '{n} notas', view: 'Cámara', map: 'Mapa', done: 'Salir', sky_live: 'Cielo real', sky_sunset: 'Atardecer', sky_night: 'Noche',
    view_near: 'Cámara cercana', view_far: 'Cámara lejana', view_bonnet: 'Cámara de capó', view_cockpit: 'Dentro del coche', view_foot: 'A pie', view_shoulder: 'Sobre el hombro', view_first: 'Primera persona',
    left: 'Girar a la izquierda', right: 'Girar a la derecha', gas: 'Acelerar', brake: 'Frenar o marcha atrás', drift: 'Derrapar',
    map_hint: 'Toca para cerrar', home: 'Casa', hint_keys: 'WASD para conducir, Espacio para derrapar, F para bajar, Q radio, V cámara, M mapa',
    hint_touch: 'Mantén las flechas para conducir, toca Derrapar para deslizar', splash: 'Al agua', back_on_road: 'De vuelta a la carretera', stunt: 'Salto', air: '{s} s en el aire',
    note: 'Pósit', crate: 'Caja de semillas', crate_sub: 'Una semilla gratis para tu huerto', visit: 'Hola, {n}', visit_sub: 'La visita cuenta al terminar',
    trial_go: '¡Ya! Sigue los aros', medal_gold: 'Medalla de oro', medal_silver: 'Medalla de plata', medal_bronze: 'Medalla de bronce', no_medal: 'El oro es {t}',
    out_of_fuel: 'Sin gasolina', drive_over: 'Fin del paseo', study_more: 'Estudia un poco más para llenar el depósito.', fuel_waits: 'La gasolina que no usaste te espera para la próxima.',
    time_driven: 'Tiempo en la ciudad', notes: 'Pósits', crates: 'Cajas de semillas', jumps: 'Saltos', visits: 'Amigos visitados', best_trial: 'Mejor contrarreloj', back: 'Volver al huerto',
    loading: 'Cargando la ciudad', loading_tex: 'Cargando texturas', loading_city: 'Construyendo la ciudad', loading_trees: 'Plantando árboles', loading_props: 'Colocando el mobiliario', loading_cars: 'Llenando las calles', loading_light: 'Encendiendo luces',
    get_out: 'Bajar', get_in: 'Subir', talk: 'Hablar', enter: 'Entrar', settings: 'Ajustes', quality: 'Calidad', language: 'Idioma', voices: 'Voces', subtitles: 'Subtítulos',
    q_next: 'Cambia en tu próximo paseo', q_auto: 'Auto', q_low: 'Baja', q_medium: 'Media', q_high: 'Alta', q_ultra: 'Ultra', on: 'Sí', off: 'No', close: 'Cerrar',
    radio_off: 'Radio apagada', wanted: 'Buscado', busted: 'Detenido', wasted: 'K.O.', cash: 'monedas',
    back_on_land: 'De vuelta en tierra', slow_down: 'Para el coche primero', too_far: 'Tu coche está lejos', find_car: 'Acércate y pulsa F',
    place_cafe: 'Cafetería', place_shop: 'Tienda de ropa', place_garage: 'Taller', place_gym: 'Gimnasio', place_flat: 'Tu piso',
    p_leave: 'Salir', p_coffee: 'Pedir un café', p_shop: 'Ver ropa', p_garage: 'Coches y pintura', p_bag: 'Golpear el saco (clic o J)', p_desk: 'Tu escritorio', p_bed: 'Tumbarte', p_mirror: 'Espejo', p_ring: 'El ring',
    do_coffee: 'Café con leche', do_coffee_sub: 'Hoy invita la casa', do_desk: 'Tu escritorio', do_desk_sub: 'Cada minuto que estudias en Bloc llena 12 s de gasolina', do_bed: 'Cinco minutos más', do_bed_sub: 'La ciudad te espera',
    do_mirror: 'Qué bien te queda', do_mirror_sub: 'Cámbiate de ropa en el mostrador', do_ring: 'El ring abre pronto', do_ring_sub: 'Los combates llegan con la actualización de peleas', do_bag: 'Directo', do_bag_sub: 'Clic o J para golpear',
    slot_top: 'Arriba', slot_bottom: 'Abajo', slot_shoes: 'Zapatos', slot_hat: 'Gorras', slot_body: 'Cuerpo y pelo', skin: 'Piel', hair: 'Pelo', hair_colour: 'Color de pelo', body_free: 'Cambiar cuerpo y pelo es gratis.',
    hair_short: 'Corto', hair_buzz: 'Rapado', hair_curly: 'Rizado', hair_long: 'Largo', hair_bun: 'Moño', hair_none: 'Calvo',
    wearing: 'Puesto', owned: 'Tuyo', bought: 'Comprado: {n}', no_coins: 'Aún no tienes monedas suficientes', need_house: 'Necesitas una casa más grande', try_again: 'No ha funcionado. Inténtalo otra vez.', cars: 'Coches', paint: 'Pintura', driving: 'En uso',
    staff_barista: 'Camarera', staff_clerk: 'Dependiente', staff_mechanic: 'Mecánico', staff_coach: 'Entrenador',
    job_courier: 'Reparto', job_taxi: 'Taxi', job_errand: 'Recado a pie', job_go: 'Ve al marcador rojo', job_done: 'Hecho: +{n} monedas al terminar', job_late: 'Demasiado lento, se cancela', need_car: 'Este necesita coche', need_foot: 'Este es a pie', passenger: 'Pasajera', customer: 'Cliente', jobs: 'Trabajos', repair: 'Reparar el coche', repair_sub: 'Gratis, sin abolladuras ni humo', repaired: 'Como nuevo', plane: 'Avioneta de la escuela', fly: 'Pilotar la avioneta', plane_keys: 'W y S potencia, flechas para subir y bajar, A y D para girar, F para bajar al aterrizar', plane_touch: 'Arriba y abajo para subir y bajar, izquierda y derecha para girar, Derrapar para más potencia', land_first: 'Aterriza y para primero', crash: 'Aterrizaje forzoso', crash_sub: 'La avioneta vuelve al aeropuerto', lost_them: 'Los has despistado', lost_them_sub: 'La policía se rinde', busted_sub: 'Solo un aviso, no pierdes monedas', officer: 'Agente', driver: 'Conductor', ko: 'K.O.', ko_sub: 'Te despiertas un momento después. No pierdes monedas.', web_only: 'Las peleas solo están en la web', bout: 'Sparring', bout_sub: 'Gana quien conecte cinco golpes. Clic o J para golpear.', bout_won: 'Has ganado el combate', bout_won_sub: 'El entrenador está impresionado', bout_lost: 'A la lona', bout_lost_sub: 'Levántate y vuelve a intentarlo', sparring: 'Compañero de sparring', radio: 'Radio'
  }
};
export const LANG = { v: 'en' };
/* v7.3: weapons, the range and the blood setting */
Object.assign(S.en, {
  place_arms: 'Bullseye Range', p_arms: 'Weapons and armour', p_lane: 'Shooting lanes', staff_gunsmith: 'Range officer',
  arms_title: 'Bullseye Range', arms_weapons: 'Weapons', arms_armour: 'Armour', arms_armour_sub: 'Takes most of the damage until it wears out. Refills every drive.',
  arms_buy: '{p} coins', arms_owned: 'Yours', arms_owned_draw: 'Yours. Press G to draw it', arms_equip: 'Press G to draw it', arms_dmg: 'Damage', arms_rate: 'Fire rate', arms_range: 'Range',
  arms_blood: 'Blood and gore', arms_blood_off: 'Off. People fall over and get back up later.', arms_blood_ask: 'I’m 16 or older: turn blood on',
  arms_blood_wait: 'Waiting for the Bloc admin to approve it. Until then blood stays off.', arms_blood_on: 'On. You see blood in fights and shootouts.', arms_blood_stop: 'Turn blood off',
  arms_confirm: 'Press again to confirm you are 16 or older',
  holster: 'Fists', reload: 'Reloading', no_arms: 'No weapons yet', no_arms_sub: 'Buy one at Bullseye Range (the yellow door)', web_arms: 'Weapons are on the website only',
  not_here: 'Not in here', not_here_sub: 'Put it away inside shops', aim_hint: 'Right mouse to aim, click to shoot, R to reload, G to switch',
  aim_touch: 'Tap Fire to shoot', fire: 'Fire', arm: 'Weapon', down: 'Down', down_sub: 'You come round a moment later. No coins lost.', armour_hud: 'Armour',
  target_hit: 'Hit', bullseye: 'Bullseye',
  your_plane: 'Your plane', plane_buy: 'Buy your own plane', plane_sub: 'Faster than the school plane, in your colour, waiting at the airport', plane_owned: 'Yours. It waits on the airport apron. Pick its colour:', plane_bought: 'Your plane is at the airport', own_plane: 'Your plane',
  furn_title: 'Order furniture', furn_sub: 'It arrives straight away. Everything stays in your flat.', furn_home: 'In your flat', p_desk: 'Order furniture',
  furn_rug: 'Rug', furn_plants: 'Three plants', furn_beanbags: 'Bean bags', furn_shelf: 'Bookshelf', furn_art: 'Wall art', furn_chair: 'Gaming chair', furn_neon: 'Neon sign', furn_speakers: 'Speakers', furn_console: 'Games console and big TV', furn_telescope: 'Telescope', furn_aquarium: 'Aquarium', furn_arcade: 'Arcade cabinet',
  me: 'You', bus_driver: 'Bus driver', tower: 'Tower', courier: 'Delivery', steal: 'Take this car', too_fast: 'It’s moving too fast', too_fast_sub: 'Wait for it to stop, at a light for example', jack_title: 'They won’t let go', jack_keys: 'Hold or keep pressing F', jack_touch: 'Keep tapping Pull', jack_btn: 'Pull', stolen: 'It’s yours now', stolen_sub: 'Your own car stays where you left it', stolen_cop: 'A police car. They will not like this.'
});
Object.assign(S.es, {
  place_arms: 'Galería Bullseye', p_arms: 'Armas y chaleco', p_lane: 'Calles de tiro', staff_gunsmith: 'Encargado de la galería',
  arms_title: 'Galería Bullseye', arms_weapons: 'Armas', arms_armour: 'Chaleco', arms_armour_sub: 'Aguanta casi todo el daño hasta que se gasta. Se recarga cada vez que conduces.',
  arms_buy: '{p} monedas', arms_owned: 'Tuya', arms_owned_draw: 'Tuya. Pulsa G para sacarla', arms_equip: 'Pulsa G para sacarla', arms_dmg: 'Daño', arms_rate: 'Cadencia', arms_range: 'Alcance',
  arms_blood: 'Sangre', arms_blood_off: 'Desactivada. La gente cae al suelo y luego se levanta.', arms_blood_ask: 'Tengo 16 años o más: activar la sangre',
  arms_blood_wait: 'Esperando a que el admin de Bloc lo apruebe. Mientras tanto no hay sangre.', arms_blood_on: 'Activada. Verás sangre en peleas y tiroteos.', arms_blood_stop: 'Quitar la sangre',
  arms_confirm: 'Pulsa otra vez para confirmar que tienes 16 años o más',
  holster: 'Puños', reload: 'Recargando', no_arms: 'Aún no tienes armas', no_arms_sub: 'Compra una en la Galería Bullseye (la puerta amarilla)', web_arms: 'Las armas solo están en la web',
  not_here: 'Aquí no', not_here_sub: 'Guárdala dentro de las tiendas', aim_hint: 'Botón derecho para apuntar, clic para disparar, R recarga, G cambia',
  aim_touch: 'Toca Disparar', fire: 'Disparar', arm: 'Arma', down: 'Al suelo', down_sub: 'Te recuperas enseguida. No pierdes monedas.', armour_hud: 'Chaleco',
  target_hit: 'Tocado', bullseye: 'En el centro',
  your_plane: 'Tu avioneta', plane_buy: 'Comprar tu propia avioneta', plane_sub: 'Más rápida que la de la escuela, de tu color, esperando en el aeropuerto', plane_owned: 'Tuya. Te espera en el aeropuerto. Elige el color:', plane_bought: 'Tu avioneta está en el aeropuerto', own_plane: 'Tu avioneta',
  furn_title: 'Pedir muebles', furn_sub: 'Llegan al momento. Todo se queda en tu piso.', furn_home: 'En tu piso', p_desk: 'Pedir muebles',
  furn_rug: 'Alfombra', furn_plants: 'Tres plantas', furn_beanbags: 'Pufs', furn_shelf: 'Estantería', furn_art: 'Cuadros', furn_chair: 'Silla gaming', furn_neon: 'Cartel de neón', furn_speakers: 'Altavoces', furn_console: 'Consola y tele grande', furn_telescope: 'Telescopio', furn_aquarium: 'Acuario', furn_arcade: 'Máquina recreativa',
  me: 'Tú', bus_driver: 'Conductor del bus', tower: 'Torre', courier: 'Repartidor', steal: 'Llevarte este coche', too_fast: 'Va demasiado rápido', too_fast_sub: 'Espera a que pare, en un semáforo por ejemplo', jack_title: 'No suelta el volante', jack_keys: 'Mantén o pulsa repetidamente la F', jack_touch: 'Toca Tirar sin parar', jack_btn: 'Tirar', stolen: 'Ahora es tuyo', stolen_sub: 'Tu coche se queda donde lo dejaste', stolen_cop: 'Un coche de policía. No les va a hacer gracia.'
});
export function setLang(l) { LANG.v = l === 'es' ? 'es' : 'en'; try { localStorage.setItem('bloc:city:lang', LANG.v); } catch (e) { /* private mode */ } }
export function initLang(fromApp) {
  let l = null; try { l = localStorage.getItem('bloc:city:lang'); } catch (e) { /* private mode */ }
  LANG.v = l === 'es' || l === 'en' ? l : fromApp === 'es' || /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
}
export function T(k, vars) {
  let s = (S[LANG.v] && S[LANG.v][k]) || S.en[k] || k;
  if (vars) for (const v in vars) s = s.replace('{' + v + '}', vars[v]);
  return s;
}
