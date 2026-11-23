/* Interface and dialogue language. English or Spanish, picked in the settings sheet (or from the app). */
const S = {
  en: {
    fuel: 'fuel left', fuel_notes: '{n} notes', view: 'View', map: 'Map', done: 'Done', sky_live: 'Live sky', sky_sunset: 'Sunset', sky_night: 'Night',
    view_near: 'Close camera', view_far: 'Far camera', view_bonnet: 'Bonnet camera', view_cockpit: 'Inside the car', view_foot: 'On foot', view_shoulder: 'Over the shoulder', view_first: 'First person',
    left: 'Steer left', right: 'Steer right', gas: 'Gas', brake: 'Brake or reverse', drift: 'Drift',
    map_hint: 'Tap anywhere to close', home: 'Home', hint_keys: 'WASD or arrows to drive, Space to drift, V camera, M map',
    hint_touch: 'Hold the arrows to drive, tap Drift to slide', splash: 'Splash', back_on_road: 'Back on the road', stunt: 'Stunt jump', air: '{s} s in the air',
    note: 'Sticky note', crate: 'Seed crate', crate_sub: 'A free seed for your garden', visit: 'Hi {n}', visit_sub: 'Your visit counts at the end',
    trial_go: 'Go! Follow the rings', medal_gold: 'Gold medal', medal_silver: 'Silver medal', medal_bronze: 'Bronze medal', no_medal: 'Gold is {t}',
    out_of_fuel: 'Out of fuel', drive_over: 'Drive over', study_more: 'Study a bit more to fill the tank again.', fuel_waits: 'The fuel you didn’t use waits for next time.',
    time_driven: 'Time in the city', notes: 'Sticky notes', crates: 'Seed crates', jumps: 'Stunt jumps', visits: 'Friends visited', best_trial: 'Best trial', back: 'Back to the garden',
    loading: 'Loading the city', loading_tex: 'Loading textures', loading_city: 'Building the city', loading_trees: 'Growing trees', loading_props: 'Placing street furniture', loading_cars: 'Filling the streets', loading_light: 'Lighting',
    get_out: 'Get out', get_in: 'Get in', talk: 'Talk', enter: 'Go in', settings: 'Settings', quality: 'Quality', language: 'Language', voices: 'Voices', subtitles: 'Subtitles',
    q_next: 'Changes on your next drive', q_auto: 'Auto', q_low: 'Low', q_medium: 'Medium', q_high: 'High', q_ultra: 'Ultra', on: 'On', off: 'Off', close: 'Close',
    radio_off: 'Radio off', wanted: 'Wanted', busted: 'Busted', wasted: 'Wasted', cash: 'coins'
  },
  es: {
    fuel: 'gasolina', fuel_notes: '{n} notas', view: 'Cámara', map: 'Mapa', done: 'Salir', sky_live: 'Cielo real', sky_sunset: 'Atardecer', sky_night: 'Noche',
    view_near: 'Cámara cercana', view_far: 'Cámara lejana', view_bonnet: 'Cámara de capó', view_cockpit: 'Dentro del coche', view_foot: 'A pie', view_shoulder: 'Sobre el hombro', view_first: 'Primera persona',
    left: 'Girar a la izquierda', right: 'Girar a la derecha', gas: 'Acelerar', brake: 'Frenar o marcha atrás', drift: 'Derrapar',
    map_hint: 'Toca para cerrar', home: 'Casa', hint_keys: 'WASD o flechas para conducir, Espacio para derrapar, V cámara, M mapa',
    hint_touch: 'Mantén las flechas para conducir, toca Derrapar para deslizar', splash: 'Al agua', back_on_road: 'De vuelta a la carretera', stunt: 'Salto', air: '{s} s en el aire',
    note: 'Pósit', crate: 'Caja de semillas', crate_sub: 'Una semilla gratis para tu huerto', visit: 'Hola, {n}', visit_sub: 'La visita cuenta al terminar',
    trial_go: '¡Ya! Sigue los aros', medal_gold: 'Medalla de oro', medal_silver: 'Medalla de plata', medal_bronze: 'Medalla de bronce', no_medal: 'El oro es {t}',
    out_of_fuel: 'Sin gasolina', drive_over: 'Fin del paseo', study_more: 'Estudia un poco más para llenar el depósito.', fuel_waits: 'La gasolina que no usaste te espera para la próxima.',
    time_driven: 'Tiempo en la ciudad', notes: 'Pósits', crates: 'Cajas de semillas', jumps: 'Saltos', visits: 'Amigos visitados', best_trial: 'Mejor contrarreloj', back: 'Volver al huerto',
    loading: 'Cargando la ciudad', loading_tex: 'Cargando texturas', loading_city: 'Construyendo la ciudad', loading_trees: 'Plantando árboles', loading_props: 'Colocando el mobiliario', loading_cars: 'Llenando las calles', loading_light: 'Encendiendo luces',
    get_out: 'Bajar', get_in: 'Subir', talk: 'Hablar', enter: 'Entrar', settings: 'Ajustes', quality: 'Calidad', language: 'Idioma', voices: 'Voces', subtitles: 'Subtítulos',
    q_next: 'Cambia en tu próximo paseo', q_auto: 'Auto', q_low: 'Baja', q_medium: 'Media', q_high: 'Alta', q_ultra: 'Ultra', on: 'Sí', off: 'No', close: 'Cerrar',
    radio_off: 'Radio apagada', wanted: 'Buscado', busted: 'Detenido', wasted: 'K.O.', cash: 'monedas'
  }
};
export const LANG = { v: 'en' };
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
