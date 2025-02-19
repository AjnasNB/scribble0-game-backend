# Real-Time Drawing Game

A real-time peer-to-peer drawing application with timer controls and admin features. Two users can join a room and draw together in real-time, with one user having admin controls for managing the timer.

## Features

- Real-time drawing synchronization between two users
- Admin controls for timer management
- Room-based system for private drawing sessions
- Clean and modern UI with Material-UI
- Canvas-based drawing interface
- Timer countdown display
- User count tracking

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository
2. Install server dependencies:
   ```bash
   npm install
   ```
3. Install client dependencies:
   ```bash
   cd client
   npm install
   ```

## Running the Application

1. Start the server (from the root directory):
   ```bash
   npm start
   ```

2. In a new terminal, start the client:
   ```bash
   cd client
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Generate a new room or enter an existing room ID
2. Choose whether to join as an admin (admin has timer control)
3. Share the room ID with another user
4. Start drawing together!

### Admin Features

- Set and start timer (up to 5 minutes)
- Timer controls are only visible to admin users

### Drawing Features

- Real-time drawing synchronization
- Clear canvas option
- User count display

## Technologies Used

- React.js
- Node.js
- Socket.IO
- Material-UI
- Express.js

## License

MIT License 