import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import CreateRoom from './pages/CreateRoom';
import RoomPage from './pages/RoomPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CreateRoom />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </Router>
  );
}

export default App;
