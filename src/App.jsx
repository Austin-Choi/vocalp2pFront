import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import CreateRoomPage from './pages/CreateRoomPage';  // 방 생성 페이지 (메인 페이지)
import JoinRoomPage from './pages/JoinRoomPage';      // Callee가 링크를 통해 입장하는 페이지
import CallerPage from './pages/CallerPage';          // Caller의 역할 페이지
import CalleePage from './pages/CalleePage';          // Callee의 역할 페이지

function App() {
  return (
    <Router>
      <Switch>
        {/* 메인 페이지: 애플리케이션의 기본 진입점으로 설정 */}
        <Route exact path="/" component={CreateRoomPage} />

        {/* Callee가 방 링크를 통해 입장할 때 */}
        <Route path="/room/:roomID/join" component={JoinRoomPage} />

        {/* Caller 페이지: 방에 입장한 후 음성만 통화 페이지 */}
        <Route path="/room/:roomID/caller" component={CallerPage} />

        {/* Callee 페이지: STT, TTS 기능이 활성화된 페이지 */}
        <Route path="/room/:roomID/callee" component={CalleePage} />
      </Switch>
    </Router>
  );
}

export default App;