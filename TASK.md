# web-game multi-player
A web-browser multiplayer game of your choice. It must support up to 4 players who can each join a match from their own computer.

## The situation
You work for an outdoor youth organization, and bad weather has been forecast for the summer months. This means more time in dormitories than planned.
Your supervisor thinks that spending too much time indoors, while thinking about outdoors, will drive everyone mad. They ask you to think about creating some games to provide light entertainment.
You remembered that each summer camper was provided with a computer and a WiFi hot spot. You decide to create something digital so that they can play against each other.
One problem though, they have a special browser which was installed to make it harder to play games; the browsers have the HTML canvas element disabled.
As such, you decide to create a playable game which uses DOM elements only.

## Functional requirements

### The game
Any.
You can make any game of your choice.
Any? Almost any.
Your game must be playable by between 2 and 4 players. Your game can be inspired by some game that you have seen or played before, or you can invent something using your own creativity.
It cannot be a words/numbers game like sudoku or a word search. It must have playable characters, or a level of interactivity which is competitive in nature. Like a resource-gathering game.

### Game play
The playable characters must be equal, so that each player has an equal chance of winning.
It must be playable by between 2 and 4 players simultaneously, and must not be turns based. I.e. each player must be able to play and act simultaneously in real-time.
Each player must be able to control their character from their own computer using a web browser.
Each player should be able to see all other players' characters at any time. I.e. it must be an interactive experience.

### Joining the game
Each player must go to their web browser, type a URL and land at the join screen. They must be able to select a player name, and wait for the game to start. This could be from a list, or by typing. Either way, each name must be unique.
The lead player is the person who invited people to join their session. I.e. the one who is running the game server. They should be able to start the game once they're happy that all the players are present and ready to play.
You'll need to find some way to expose the game to other players via the internet (not via a local network).

### Animation
Your game must be smooth, with no noticeable lag or stuttering. It must be jank free.
Your game must maintain a constant minimum frame rate of 60 FPS, and ensure proper utilization of RequestAnimationFrame for smooth animation rendering.
It is recommended to make minimal use of layers to optimize rendering performance.
The game must be implemented using DOM (Document Object Model) elements for rendering and interaction. The use of canvas is strictly prohibited.
The Performance Tool is your friend. Use it to monitor and optimize in-game performance. Amongst other things, you'll be able to monitor frame-drops, monitor FPS, and see how long your functions take to execute.

### Menu
You must implement an in-game menu, which enables players to
- Pause the game
- Resume the game
- Quit the game
Whether the game is paused, quit or restarted, a message must be displayed to all players to describe who did it.

### Scoring and winning
You must implement some scoring system, which defines how to win the game.
This could be that the highest score wins, or the last player to have not lost all of their lives.
Whichever scoring system you implement, it must be possible to see the scores for each player in real-time. I.e. it must be dynamically updated for all players to see.
At the end of the game, the winner must be displayed.

### Game timer
Your game must display a timer.
The timer can count upwards to show how long the round lasted, or count down after which the player with the highest score wins.

## Extra requirements

### Keyboard controls
Enable players to play using their computer keyboards, ensuring smooth responsive game play with no input delays, or long-press glitches.

### Sound effects
Incorporate sound effects into the game.
This could be for when the game starts or ends, something related to a player action, losing a life, reaching some scoring objectives anything something else.

## Bonus functionality
You're welcome to implement other bonuses as you see fit. But anything you implement must not change the default functional behavior of your project.
You may use additional feature flags, command line arguments or separate builds to switch your bonus functionality on.
Here are some bonus ideas to inspire you:
- Support for additional gameplay features such as power-ups, special abilities, or custom game modes to enhance replayability and engagement.
- Chat functionality, allowing players to communicate with each other in real-time during gameplay sessions.
- Accessibility features such as customizable controls, colorblind mode, or screen reader support to make it inclusive and useable for more players.

## Resources
- requestAnimationFrame
- Event Loop
- Jank-free animations
- What are Developer Tools?
- Chrome DevTools

## Useful links
Some game ideas to get the creative juices flowing:
- A Battle Royale game like ZombsRoyale.io
- A puzzle game like Tetris
- A strategy game like Warzone 2100
- A survival game like: Moomoo.io
- A map roaming game like Super Bomberman
- A game inspired by Space Invaders

## What you'll learn
- Advanced JavaScript programming techniques for game development.
- Strategies for optimizing game performance and ensuring smooth animation.
- Real-time multiplayer networking concepts and implementation.
- Effective use of developer tools for debugging and performance analysis.
