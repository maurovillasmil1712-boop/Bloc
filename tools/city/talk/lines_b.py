# Bloc City: chats between strangers (overheard when you walk past) and conversations where you pick the answer.
# Original writing for Bloc. Each line: (voice, English, Spanish).
PAIRS = [
  [('m', "Did you see the new towers downtown?", "¿Has visto las torres nuevas del centro?"), ('f', "The tall one? It blocks my sunset.", "¿La alta? Me tapa el atardecer."), ('m', "It has a sunset on the roof, though.", "Pero tiene un atardecer en la azotea.")],
  [('f', "I think my plants can hear me.", "Creo que mis plantas me escuchan."), ('m', "What do you tell them?", "¿Y qué les dices?"), ('f', "Mostly to grow faster. They ignore me.", "Sobre todo que crezcan más rápido. Pasan de mí.")],
  [('m', "I'm starting a podcast.", "Voy a empezar un pódcast."), ('m', "About what?", "¿Sobre qué?"), ('m', "About starting a podcast.", "Sobre empezar un pódcast.")],
  [('f', "My cat learned to open the fridge.", "Mi gata ha aprendido a abrir la nevera."), ('f', "That's terrifying.", "Eso da miedo."), ('f', "She took the cheese and left a dead sock.", "Se llevó el queso y dejó un calcetín muerto.")],
  [('m', "I parked right here. I swear.", "Aparqué aquí mismo. Te lo juro."), ('f', "Is that it, being towed?", "¿Es ese, el que se lleva la grúa?"), ('m', "...No. Definitely not. Let's go.", "...No. Para nada. Vámonos.")],
  [('f', "I tried that new café. They draw your face in the foam.", "Probé la cafetería nueva. Te dibujan la cara en la espuma."), ('m', "Was it a good likeness?", "¿Se parecía?"), ('f', "It looked like a sad potato.", "Parecía una patata triste."), ('m', "So yes.", "O sea, que sí.")],
  [('m', "Do you think fish get thirsty?", "¿Tú crees que los peces tienen sed?"), ('m', "Mate, it's nine in the morning.", "Tío, son las nueve de la mañana."), ('m', "It's a valid question.", "Es una pregunta válida.")],
  [('f', "My mum signed me up for boxing.", "Mi madre me ha apuntado a boxeo."), ('f', "Do you like it?", "¿Te gusta?"), ('f', "I punched a bag so hard it apologised.", "Le di tan fuerte al saco que me pidió perdón.")],
  [('m', "I'm on a diet.", "Estoy a dieta."), ('f', "You're eating a churro.", "Te estás comiendo un churro."), ('m', "It's a small churro. Diet-sized.", "Es un churro pequeño. Tamaño dieta.")],
  [('f', "Why are you dressed like that?", "¿Por qué vas vestido así?"), ('m', "Job interview.", "Entrevista de trabajo."), ('f', "In shorts?", "¿En pantalón corto?"), ('m', "It's a beach bar.", "Es un chiringuito.")],
  [('m', "My neighbour practises trumpet at midnight.", "Mi vecino toca la trompeta a medianoche."), ('f', "Is he any good?", "¿Y lo hace bien?"), ('m', "That's the worst part. No.", "Eso es lo peor. No.")],
  [('f', "I finally organised my wardrobe.", "Por fin he ordenado el armario."), ('f', "How does it feel?", "¿Y qué tal?"), ('f', "Like I own nothing and also too much.", "Como si no tuviera nada y a la vez demasiado.")],
  [('m', "Have you seen my sunglasses?", "¿Has visto mis gafas de sol?"), ('m', "They're on your head.", "Las llevas en la cabeza."), ('m', "Oh. They were there all along.", "Anda. Estaban ahí todo el rato."), ('m', "Like a movie.", "Como en una peli.")],
  [('f', "I want a dog.", "Quiero un perro."), ('m', "You can't even keep a cactus alive.", "No eres capaz ni de mantener vivo un cactus."), ('f', "The cactus had issues.", "El cactus tenía sus problemas.")],
  [('m', "There's a new gym near the plaza.", "Hay un gimnasio nuevo cerca de la plaza."), ('f', "Are you going to join?", "¿Te vas a apuntar?"), ('m', "I'm going to walk past it a lot.", "Voy a pasar mucho por delante.")],
  [('f', "I can see the sea from my window.", "Desde mi ventana se ve el mar."), ('m', "Lucky you. I see a wall.", "Qué suerte. Yo veo una pared."), ('f', "A nice wall?", "¿Una pared bonita?"), ('m', "It's a very honest wall.", "Es una pared muy sincera.")],
  [('m', "I failed my driving test.", "He suspendido el examen de conducir."), ('m', "What happened?", "¿Qué pasó?"), ('m', "I waved at the examiner's friend. While turning.", "Saludé al amigo del examinador. Mientras giraba.")],
  [('f', "My little brother says he'll be a millionaire by twenty.", "Mi hermano pequeño dice que será millonario a los veinte."), ('f', "How old is he?", "¿Cuántos años tiene?"), ('f', "Nineteen.", "Diecinueve.")],
  [('m', "Is that a new jacket?", "¿Esa chaqueta es nueva?"), ('f', "Fifteen hundred coins.", "Mil quinientas monedas."), ('m', "You studied for that?", "¿Has estudiado para eso?"), ('f', "Every single minute.", "Cada minuto.")],
  [('f', "I think the pigeons here are organised.", "Creo que las palomas de aquí están organizadas."), ('m', "Organised how?", "¿Organizadas cómo?"), ('f', "One distracts you, the other takes your sandwich.", "Una te distrae y la otra te roba el bocadillo.")],
  [('m', "I'm going to wake up at six every day.", "Voy a levantarme a las seis todos los días."), ('m', "Since when?", "¿Desde cuándo?"), ('m', "Starting next Monday. Every Monday, since March.", "Desde el lunes que viene. Cada lunes, desde marzo.")],
  [('f', "Did you hear that noise last night?", "¿Oíste ese ruido anoche?"), ('f', "The fireworks?", "¿Los fuegos artificiales?"), ('f', "No, my dad singing in the shower.", "No, mi padre cantando en la ducha.")],
  [('m', "This city has too many roundabouts.", "Esta ciudad tiene demasiadas rotondas."), ('f', "I love roundabouts.", "A mí me encantan las rotondas."), ('m', "You went round that one four times.", "Le diste cuatro vueltas a esa."), ('f', "I was enjoying it.", "Estaba disfrutando.")],
  [('f', "I'm going to learn Japanese.", "Voy a aprender japonés."), ('m', "How's your English?", "¿Y qué tal tu inglés?"), ('f', "We don't talk about my English.", "De mi inglés no hablamos.")],
  [('m', "My grandad still uses a flip phone.", "Mi abuelo todavía usa un móvil de tapa."), ('f', "Does he text?", "¿Manda mensajes?"), ('m', "One word a day. Today it was 'potatoes'.", "Una palabra al día. Hoy ha sido 'patatas'.")],
  [('f', "Should I cut my hair short?", "¿Me corto el pelo corto?"), ('f', "Last time you cried for a week.", "La última vez lloraste una semana."), ('f', "Yes, but it was a productive week.", "Sí, pero fue una semana productiva.")],
  [('m', "I left my phone at home.", "Me he dejado el móvil en casa."), ('m', "How do you feel?", "¿Cómo te sientes?"), ('m', "Free. And terrified.", "Libre. Y aterrado.")],
  [('f', "I bought a plant that grows in the dark.", "Me he comprado una planta que crece a oscuras."), ('m', "That's a mushroom.", "Eso es una seta."), ('f', "It's a very confident plant.", "Es una planta con mucha seguridad.")],
  [('m', "I'm writing a novel.", "Estoy escribiendo una novela."), ('f', "What's it about?", "¿De qué va?"), ('m', "A guy writing a novel. It's very personal.", "De un tío que escribe una novela. Es muy personal.")],
  [('f', "Can you smell churros?", "¿Hueles a churros?"), ('m', "I can always smell churros.", "Yo siempre huelo a churros."), ('f', "That's not normal.", "Eso no es normal."), ('m', "It's a gift.", "Es un don.")],
  [('m', "My sister got into university.", "Mi hermana ha entrado en la universidad."), ('f', "That's amazing! What's she studying?", "¡Qué bien! ¿Qué va a estudiar?"), ('m', "Philosophy. So, she'll be asking why.", "Filosofía. O sea, que va a preguntar por qué.")],
  [('f', "I can't find my car keys.", "No encuentro las llaves del coche."), ('f', "You don't have a car.", "No tienes coche."), ('f', "That would explain a lot.", "Eso explicaría muchas cosas.")],
  [('m', "Is it going to rain?", "¿Va a llover?"), ('m', "My knee says yes.", "Mi rodilla dice que sí."), ('m', "Your knee is a better forecast than the app.", "Tu rodilla acierta más que la app.")],
  [('f', "I tried yoga at the beach.", "Probé yoga en la playa."), ('m', "How was it?", "¿Qué tal?"), ('f', "A seagull stole my water and my dignity.", "Una gaviota me robó el agua y la dignidad.")],
  [('m', "I've been walking for an hour.", "Llevo una hora andando."), ('f', "Where are you going?", "¿Adónde vas?"), ('m', "Honestly? I forgot.", "¿Sinceramente? Se me ha olvidado.")],
  [('f', "Do you think the island is haunted?", "¿Crees que la isla está encantada?"), ('f', "Only by tourists.", "Solo por turistas."), ('f', "Same thing in August.", "En agosto es lo mismo.")],
  [('m', "Look at that car! So clean.", "¡Mira ese coche! Qué limpio."), ('m', "Wait till it rains.", "Espera a que llueva."), ('m', "Why would you say that?", "¿Por qué dices eso?"), ('m', "Life experience.", "Experiencia vital.")],
  [('f', "I got a ninety-eight on my exam!", "¡He sacado un noventa y ocho en el examen!"), ('m', "Out of?", "¿Sobre?"), ('f', "...Two hundred. But still!", "...Doscientos. ¡Pero bueno!")],
  [('m', "I'm thinking of moving to the island.", "Estoy pensando en mudarme a la isla."), ('f', "And the bridge every day?", "¿Y el puente todos los días?"), ('m', "I'll swim. Builds character.", "Iré nadando. Forja el carácter.")],
  [('f', "My mum texts in all capitals.", "Mi madre escribe todo en mayúsculas."), ('m', "Always angry?", "¿Siempre enfadada?"), ('f', "Always loving. Very loudly.", "Siempre cariñosa. Muy alto.")],
  [('m', "Remember when we got lost at the port?", "¿Te acuerdas de cuando nos perdimos en el puerto?"), ('f', "We didn't get lost. We discovered.", "No nos perdimos. Descubrimos."), ('m', "We discovered the same crane three times.", "Descubrimos la misma grúa tres veces.")],
  [('f', "Can I borrow ten euros?", "¿Me dejas diez euros?"), ('m', "You still owe me twenty.", "Todavía me debes veinte."), ('f', "Then you owe me thirty for remembering.", "Entonces tú me debes treinta por acordarte.")],
  [('m', "Did the bus come?", "¿Ha pasado el autobús?"), ('m', "Three of them, all at once.", "Tres, todos a la vez."), ('m', "Classic.", "Clásico.")],
  [('f', "I've started meditating.", "He empezado a meditar."), ('m', "Is it helping?", "¿Te ayuda?"), ('f', "I'm so calm I want to scream.", "Estoy tan tranquila que quiero gritar.")],
  [('m', "My phone autocorrected my boss's name to 'Bossy'.", "El móvil me cambió el nombre de mi jefa por 'Jefaza'."), ('f', "Did she notice?", "¿Se dio cuenta?"), ('m', "She signs her emails with it now.", "Ahora firma los correos así.")],
  [('f', "Is the gym open this late?", "¿El gimnasio abre tan tarde?"), ('f', "It's always open. Like my tabs.", "Siempre está abierto. Como mis pestañas.")],
  [('m', "I think I'm getting a cold.", "Creo que me estoy resfriando."), ('f', "You said that yesterday.", "Eso dijiste ayer."), ('m', "It's a slow cold. Very polite.", "Es un resfriado lento. Muy educado.")],
  [('f', "Why is there a goat on that roof?", "¿Por qué hay una cabra en ese tejado?"), ('m', "That's a statue.", "Es una estatua."), ('f', "It just blinked.", "Acaba de parpadear.")],
  [('m', "I've decided to be a morning person.", "He decidido ser persona de mañanas."), ('f', "It's three in the afternoon.", "Son las tres de la tarde."), ('m', "I'm easing into it.", "Me voy adaptando.")],
  [('f', "Your car alarm keeps going off.", "Tu alarma no para de sonar."), ('m', "That's not an alarm. That's the radio.", "Eso no es la alarma. Es la radio."), ('f', "Oh. Sorry. Great song.", "Ah. Perdón. Gran canción.")],
]

# Conversations you start with E. The person says the opener; you pick one of three answers; they reply.
CONVOS = [
  ('f', ("Excuse me, do you know the way to the beach?", "Perdona, ¿sabes cómo ir a la playa?"), [
    (("Straight west, you can't miss the sea.", "Todo recto hacia el oeste, el mar no tiene pérdida."), ("Thanks! You're a lifesaver.", "¡Gracias! Me has salvado.")),
    (("Follow the seagulls.", "Sigue a las gaviotas."), ("Ha! They do look like they know.", "¡Ja! La verdad es que parecen saberlo.")),
    (("No idea, I'm lost too.", "Ni idea, yo también estoy perdido."), ("Great. Let's be lost together, then.", "Genial. Pues perdámonos juntos."))]),
  ('m', ("Hey, you dropped this. Oh wait, it's mine.", "Oye, se te ha caído esto. Ah, no, que es mío."), [
    (("Happens to the best of us.", "Nos pasa a todos."), ("Thanks for not laughing. Much.", "Gracias por no reírte. Mucho.")),
    (("Can I have it anyway?", "¿Me lo das de todas formas?"), ("It's a bus ticket. Used. Still want it?", "Es un billete de bus. Usado. ¿Lo sigues queriendo?")),
    (("Are you okay?", "¿Estás bien?"), ("Long day. But yes. Thanks for asking.", "Día largo. Pero sí. Gracias por preguntar."))]),
  ('f', ("I like your style. Where did you get that?", "Me gusta tu estilo. ¿Dónde lo has comprado?"), [
    (("The clothing shop near the old town.", "En la tienda de ropa del casco antiguo."), ("I'm going there right now.", "Voy ahora mismo.")),
    (("I studied for it. Every coin.", "Lo he estudiado. Cada moneda."), ("Respect. I should study more.", "Respeto. Debería estudiar más.")),
    (("It's a secret.", "Es un secreto."), ("Fine, keep your secrets, fashion spy.", "Vale, guárdate tus secretos, espía de la moda."))]),
  ('m', ("Is this the right bus stop for the airport?", "¿Esta es la parada para el aeropuerto?"), [
    (("The airport's east. Better take a car.", "El aeropuerto está al este. Mejor en coche."), ("A car. If only I had one.", "En coche. Ojalá tuviera uno.")),
    (("You're flying somewhere?", "¿Te vas de viaje?"), ("Visiting my grandma. She makes the best croquetas.", "A ver a mi abuela. Hace las mejores croquetas.")),
    (("This isn't a bus stop. It's a bench.", "Esto no es una parada. Es un banco."), ("That explains the last forty minutes.", "Eso explica los últimos cuarenta minutos."))]),
  ('f', ("Sorry, can you take a photo of me with the fountain?", "Perdona, ¿me haces una foto con la fuente?"), [
    (("Sure! Say patatas!", "¡Claro! ¡Di patata!"), ("Perfect! You're a natural.", "¡Perfecta! Eres un profesional.")),
    (("Only if I can be in it too.", "Solo si salgo yo también."), ("A selfie with a stranger. Why not?", "Un selfie con un desconocido. ¿Por qué no?")),
    (("I'm terrible at photos.", "Se me dan fatal las fotos."), ("Can't be worse than my brother. He films his thumb.", "No puede ser peor que mi hermano. Graba su dedo."))]),
  ('m', ("You look like someone who knows a good place to eat.", "Tienes pinta de saber dónde se come bien."), [
    (("The café near the plaza is great.", "La cafetería cerca de la plaza está genial."), ("Café it is. Thanks!", "Pues cafetería. ¡Gracias!")),
    (("My mum's kitchen. Not open to the public.", "La cocina de mi madre. No está abierta al público."), ("Shame. Mums always cook best.", "Qué pena. Las madres cocinan mejor que nadie.")),
    (("Anywhere with churros.", "Cualquier sitio con churros."), ("A person of culture.", "Una persona con cultura."))]),
  ('f', ("Have you seen a small white dog? Answers to Bolita.", "¿Has visto un perro blanco pequeño? Se llama Bolita."), [
    (("I'll keep an eye out.", "Estaré atento."), ("Thank you. He's probably at the bakery again.", "Gracias. Seguro que está otra vez en la panadería.")),
    (("Bolita! Here, boy!", "¡Bolita! ¡Ven aquí, bonito!"), ("He never comes when I call either.", "A mí tampoco me hace caso.")),
    (("Is that him chasing a pigeon?", "¿Ese que persigue una paloma es él?"), ("Bolita! Not again! Thank you!", "¡Bolita! ¡Otra vez no! ¡Gracias!"))]),
  ('m', ("Do you know what time it is?", "¿Sabes qué hora es?"), [
    (("Look at the sky, it's on Madrid time.", "Mira el cielo, va con la hora de Madrid."), ("Fancy. And correct.", "Qué elegante. Y exacto.")),
    (("Time to study, probably.", "Hora de estudiar, seguramente."), ("Ugh. You sound like my planner.", "Puf. Hablas como mi agenda.")),
    (("No watch, sorry.", "Sin reloj, lo siento."), ("Same. We live by vibes.", "Igual. Vivimos de sensaciones."))]),
  ('f', ("I'm new in town. Anything fun to do?", "Soy nueva en la ciudad. ¿Algo divertido que hacer?"), [
    (("Try the time trials. Beach Run is the best.", "Prueba las contrarrelojes. La de la playa es la mejor."), ("Ooh, I love a challenge.", "Uy, me encantan los retos.")),
    (("The gym has a boxing ring.", "El gimnasio tiene un ring de boxeo."), ("I'll leave the punching to you.", "Lo de los puñetazos te lo dejo a ti.")),
    (("Watch the sunset from the bridge.", "Ver el atardecer desde el puente."), ("That sounds lovely. Thank you.", "Suena precioso. Gracias."))]),
  ('m', ("Do I have something on my face?", "¿Tengo algo en la cara?"), [
    (("A bit of chocolate. Left side.", "Un poco de chocolate. A la izquierda."), ("Ah. That's been there since breakfast, hasn't it?", "Ay. Eso lleva ahí desde el desayuno, ¿verdad?")),
    (("Just a smile.", "Solo una sonrisa."), ("Smooth. Very smooth.", "Qué bien queda eso.")),
    (("Your whole face, yes.", "Toda la cara, sí."), ("Wow. Okay. Fair.", "Vaya. Vale. Justo."))]),
  ('f', ("Can you help me? My car won't start.", "¿Me ayudas? Mi coche no arranca."), [
    (("Try the garage, they're good.", "Prueba en el taller, son buenos."), ("I'll call them. Thanks!", "Les llamo. ¡Gracias!")),
    (("Have you tried turning it off and on again?", "¿Has probado a apagarlo y encenderlo?"), ("It's a car, not a laptop. But... let me try.", "Es un coche, no un portátil. Pero... voy a probar.")),
    (("Is it out of fuel?", "¿No tendrá gasolina?"), ("...Oh. Oh no. That's embarrassing.", "...Ay. Ay no. Qué vergüenza."))]),
  ('m', ("Big fan of your driving. I watched you earlier.", "Fan de tu forma de conducir. Te he visto antes."), [
    (("Thanks! I'm practising for the trials.", "¡Gracias! Estoy practicando para las contrarrelojes."), ("Go for gold. I believe in you.", "A por el oro. Creo en ti.")),
    (("Was that the jump off the ramp?", "¿Lo del salto de la rampa?"), ("That landing. Wow. Ten out of ten.", "Ese aterrizaje. Uf. Un diez.")),
    (("Sorry about the bin.", "Perdón por lo de la papelera."), ("The bin had it coming.", "La papelera se lo estaba buscando."))]),
  ('f', ("Do you think it'll rain later?", "¿Crees que lloverá luego?"), [
    (("If it rains on my garden, it rains here.", "Si llueve en mi huerto, llueve aquí."), ("That's oddly specific. And probably true.", "Qué específico. Y seguramente cierto.")),
    (("Bring an umbrella just in case.", "Por si acaso, coge paraguas."), ("Wise. Very wise.", "Sabio. Muy sabio.")),
    (("I hope so, I love rain.", "Ojalá, me encanta la lluvia."), ("Me too. Puddles are free fun.", "A mí también. Los charcos son diversión gratis."))]),
  ('m', ("I'm meeting someone here but I forgot their face.", "He quedado con alguien aquí pero se me ha olvidado su cara."), [
    (("Maybe it's me?", "¿A lo mejor soy yo?"), ("Are you Marta? No? Worth a try.", "¿Eres Marta? ¿No? Había que intentarlo.")),
    (("Call them.", "Llámale."), ("Oh. Phones. Right. Modern times.", "Ah. Los móviles. Claro. Tiempos modernos.")),
    (("Wave at everyone.", "Saluda a todo el mundo."), ("Already did. Three people waved back. Now I have friends.", "Ya lo he hecho. Tres me han saludado. Ahora tengo amigos."))]),
  ('f', ("Is the clothing shop still open?", "¿Sigue abierta la tienda de ropa?"), [
    (("It's always open. Come on, I'll show you the way.", "Siempre está abierta. Venga, te digo por dónde."), ("You're the best.", "Eres lo más.")),
    (("What are you after?", "¿Qué buscas?"), ("A jacket that says 'I have my life together'.", "Una chaqueta que diga 'tengo la vida resuelta'.")),
    (("Save your coins.", "Ahorra tus monedas."), ("You sound like my dad.", "Hablas como mi padre."))]),
  ('m', ("Any idea why everyone's driving so fast today?", "¿Sabes por qué hoy conduce todo el mundo tan rápido?"), [
    (("Trial day. Medals to win.", "Día de contrarreloj. Hay medallas."), ("Ah, that explains the screaming.", "Ah, eso explica los gritos.")),
    (("Everyone's late for something.", "Todos llegan tarde a algo."), ("Story of my life.", "La historia de mi vida.")),
    (("That was mostly me. Sorry.", "Ese era yo, sobre todo. Perdón."), ("At least you're honest.", "Por lo menos eres sincero."))]),
  ('f', ("I think I've seen you in my class.", "Creo que te he visto en clase."), [
    (("Maybe! Which class?", "¡Puede! ¿Qué clase?"), ("History. You sit near the window, right?", "Historia. Te sientas al lado de la ventana, ¿no?")),
    (("Only if it was a good grade.", "Solo si saqué buena nota."), ("Ha. Let's say it was.", "Ja. Digamos que sí.")),
    (("Not me. I'm a mystery.", "Yo no. Soy un misterio."), ("A mystery in very visible trainers.", "Un misterio con unas zapatillas muy visibles."))]),
  ('m', ("Have you tried the sushi place by the port?", "¿Has probado el sushi del puerto?"), [
    (("Not yet. Is it good?", "Aún no. ¿Está bueno?"), ("Fresh as the sea. Literally, it's next to it.", "Fresco como el mar. Literalmente, está al lado.")),
    (("I don't trust raw fish.", "No me fío del pescado crudo."), ("The fish doesn't trust you either.", "El pescado tampoco se fía de ti.")),
    (("Only if you're paying.", "Solo si pagas tú."), ("Bold. I respect it. No.", "Atrevido. Lo respeto. No."))]),
  ('f', ("Could you watch my bag for a second?", "¿Me vigilas la bolsa un segundo?"), [
    (("Of course.", "Claro."), ("You're a star. Back in a sec.", "Eres un sol. Vuelvo enseguida.")),
    (("What's in it?", "¿Qué lleva?"), ("Oranges. Lots of oranges. Don't ask.", "Naranjas. Muchas naranjas. No preguntes.")),
    (("I'm not a security guard.", "No soy guardia de seguridad."), ("Fine. I'll take it to the loo with me.", "Vale. Me la llevo al baño."))]),
  ('m', ("Do you play anything? Football, basketball?", "¿Juegas a algo? ¿Fútbol, baloncesto?"), [
    (("I box a bit.", "Hago un poco de boxeo."), ("Remind me never to annoy you.", "Recuérdame que nunca te haga enfadar.")),
    (("Video games count?", "¿Los videojuegos cuentan?"), ("In my heart, absolutely.", "En mi corazón, totalmente.")),
    (("I run. Mostly late.", "Corro. Sobre todo cuando llego tarde."), ("Same. Daily cardio.", "Igual. Cardio diario."))]),
  ('f', ("Ugh, my phone just died. Do you know where I can charge it?", "Uf, se me ha muerto el móvil. ¿Sabes dónde cargarlo?"), [
    (("The café has plugs.", "En la cafetería hay enchufes."), ("And coffee. Perfect.", "Y café. Perfecto.")),
    (("Enjoy the freedom.", "Disfruta de la libertad."), ("Freedom is scary. I miss my notifications.", "La libertad da miedo. Echo de menos las notificaciones.")),
    (("Try turning it into a paperweight.", "Úsalo de pisapapeles."), ("Very funny. Very, very funny.", "Muy gracioso. Muy, muy gracioso."))]),
  ('m', ("Can you settle something? Is a hot dog a sandwich?", "¿Me resuelves una duda? ¿Un perrito caliente es un bocadillo?"), [
    (("Yes. Bread with something in it.", "Sí. Pan con algo dentro."), ("I knew it! My sister owes me a coffee.", "¡Lo sabía! Mi hermana me debe un café.")),
    (("No. It's its own thing.", "No. Es su propia categoría."), ("Ugh, you sound like my sister.", "Puf, hablas como mi hermana.")),
    (("I refuse to get involved.", "Me niego a meterme."), ("Wise. Very wise. Coward, but wise.", "Sabio. Muy sabio. Cobarde, pero sabio."))]),
  ('f', ("Is it true you get fuel from studying?", "¿Es verdad que la gasolina sale de estudiar?"), [
    (("Twelve seconds per minute of study.", "Doce segundos por cada minuto de estudio."), ("So an exam season is a road trip. Got it.", "O sea, que la época de exámenes es un viaje por carretera. Entendido.")),
    (("It's the only way.", "Es la única forma."), ("Strict. But it works, apparently.", "Estricto. Pero funciona, por lo visto.")),
    (("Don't tell anyone.", "No se lo digas a nadie."), ("Your secret is safe with me. And everyone.", "Tu secreto está a salvo conmigo. Y con todo el mundo."))]),
  ('m', ("My friend dared me to talk to a stranger. Hi.", "Mi amigo me ha retado a hablar con un desconocido. Hola."), [
    (("Hi! Mission accomplished.", "¡Hola! Misión cumplida."), ("He owes me five euros now. Thank you.", "Ahora me debe cinco euros. Gracias.")),
    (("What do I get?", "¿Y yo qué gano?"), ("My eternal gratitude and half a chocolate bar.", "Mi gratitud eterna y media tableta de chocolate.")),
    (("I'm not a stranger, I'm a friend you haven't met.", "No soy un desconocido, soy un amigo que aún no conoces."), ("That's beautiful. Are you a poster?", "Qué bonito. ¿Eres un póster?"))]),
  ('f', ("Do you know if the island has a beach?", "¿Sabes si la isla tiene playa?"), [
    (("A big one. Take the bridge.", "Una grande. Cruza el puente."), ("Packing my towel right now.", "Voy a por la toalla ya mismo.")),
    (("The best one is a secret.", "La mejor es un secreto."), ("You can't say that and walk away!", "¡No puedes decir eso e irte!")),
    (("It is a beach. The whole island.", "Es playa. Toda la isla."), ("That's the dream.", "Ese es el sueño."))]),
  ('m', ("Hey, do you have a minute to talk about plants?", "Oye, ¿tienes un minuto para hablar de plantas?"), [
    (("I grow tomatoes.", "Yo cultivo tomates."), ("A tomato person. I knew it from your aura.", "Persona de tomates. Lo sabía por tu aura.")),
    (("Only if it's a short minute.", "Solo si es un minuto corto."), ("Water them. Talk to them. That's it. Bye!", "Riégalas. Háblales. Ya está. ¡Adiós!")),
    (("No, sorry.", "No, lo siento."), ("That's okay. The plants forgive you.", "No pasa nada. Las plantas te perdonan."))]),
  ('f', ("You haven't seen a lost phone, have you?", "¿No habrás visto un móvil perdido?"), [
    (("What does it look like?", "¿Cómo es?"), ("Pink case, fifty stickers, one crack.", "Funda rosa, cincuenta pegatinas, una grieta.")),
    (("Call it, I'll listen.", "Llámalo, yo escucho."), ("It's on silent. I'm a genius.", "Está en silencio. Soy un genio.")),
    (("Check your back pocket.", "Mira en el bolsillo de atrás."), ("...How did you know? Magic?", "...¿Cómo lo sabías? ¿Magia?"))]),
  ('m', ("Is this the way to the gym?", "¿Por aquí se va al gimnasio?"), [
    (("Yes, follow the glowing door.", "Sí, sigue la puerta que brilla."), ("Glowing door. Very dramatic. I like it.", "Una puerta que brilla. Muy dramático. Me gusta.")),
    (("You're going to work out?", "¿Vas a entrenar?"), ("I'm going to look at the machines. A start.", "Voy a mirar las máquinas. Algo es algo.")),
    (("The gym is a state of mind.", "El gimnasio es un estado mental."), ("Then I'm already exhausted.", "Pues ya estoy agotado."))]),
  ('f', ("Can you recommend a good song?", "¿Me recomiendas una canción buena?"), [
    (("Anything on Bloc FM.", "Cualquiera de Bloc FM."), ("I'll tune in. Thanks!", "La pondré. ¡Gracias!")),
    (("Something to study to?", "¿Algo para estudiar?"), ("Yes. My brain needs background noise.", "Sí. Mi cerebro necesita ruido de fondo.")),
    (("I only listen to silence.", "Yo solo escucho el silencio."), ("Deep. A bit scary, but deep.", "Profundo. Da un poco de miedo, pero profundo."))]),
  ('m', ("Want to hear a joke?", "¿Quieres oír un chiste?"), [
    (("Go on.", "Venga."), ("Why did the car get a ticket? It was a wise guy. ...I'm working on it.", "¿Por qué multaron al coche? Por listillo. ...Lo estoy trabajando.")),
    (("Only if it's good.", "Solo si es bueno."), ("Then I'll save it for another day.", "Entonces lo guardo para otro día.")),
    (("I'll tell you one instead.", "Te cuento yo uno."), ("I'm all ears. Literally, look at them.", "Soy todo oídos. Literalmente, míralos."))]),
  ('f', ("Is it normal for the bridge to sway like that?", "¿Es normal que el puente se mueva así?"), [
    (("It's built for it. Totally safe.", "Está hecho para eso. Totalmente seguro."), ("Okay. I'll cross it. Quickly.", "Vale. Lo cruzo. Rápido.")),
    (("That's just the wind.", "Es solo el viento."), ("The wind is very strong then.", "Pues el viento es muy fuerte.")),
    (("What bridge?", "¿Qué puente?"), ("The one right there! Stop it.", "¡El que está ahí! Para ya."))]),
  ('m', ("I'm trying to find the best view in the city.", "Busco la mejor vista de la ciudad."), [
    (("The hills, at sunset.", "Las colinas, al atardecer."), ("The hills it is. Thank you, friend.", "Pues a las colinas. Gracias, amigo.")),
    (("The top of a tower downtown.", "Lo alto de una torre del centro."), ("If I can get past the security guard.", "Si consigo pasar al de seguridad.")),
    (("You're looking at it.", "La estás mirando."), ("Smooth. Was that about you or the street?", "Hábil. ¿Eso lo dices por ti o por la calle?"))]),
  ('f', ("Have you ever been to the airport here?", "¿Has ido alguna vez al aeropuerto de aquí?"), [
    (("The runway trial is fun.", "La contrarreloj de la pista mola."), ("You race on the runway? Is that allowed?", "¿Corres en la pista? ¿Eso se puede?")),
    (("Planes are coming soon, I hear.", "Dicen que pronto habrá aviones."), ("Flying over the city. Imagine.", "Volar sobre la ciudad. Imagínate.")),
    (("Only to watch planes.", "Solo a mirar aviones."), ("Same. It's oddly calming.", "Yo igual. Es raro lo que relaja."))]),
  ('m', ("Lovely evening, isn't it?", "Qué tarde más bonita, ¿no?"), [
    (("The best. Look at that sky.", "La mejor. Mira ese cielo."), ("Days like this make it all worth it.", "Días así hacen que todo valga la pena.")),
    (("Bit cold.", "Hace un poco de frío."), ("Grab a jacket from the shop. They're nice.", "Pilla una chaqueta en la tienda. Son bonitas.")),
    (("I've got homework.", "Tengo deberes."), ("Do them, then come back for the sunset.", "Hazlos y luego vuelve para el atardecer."))]),
  ('f', ("Do you need directions anywhere?", "¿Necesitas indicaciones para ir a algún sitio?"), [
    (("I'm good, thanks!", "Estoy bien, ¡gracias!"), ("Okay! Have a good day.", "¡Vale! Que tengas buen día.")),
    (("Where's the café?", "¿Dónde está la cafetería?"), ("Near the old town plaza. You'll smell it first.", "Cerca de la plaza del casco antiguo. Lo olerás antes de verlo.")),
    (("Directions to happiness?", "¿Y para llegar a la felicidad?"), ("Left at the churros stand. Always.", "A la izquierda en el puesto de churros. Siempre."))]),
]
