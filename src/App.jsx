import { useState, useRef } from 'react'

function App() {
  const [email, setEmail] = useState("");
  const [connected, setConnected] = useState(false);
  const socket = useRef(null); // WebSocket 객체를 위한 Ref
  const localConnection = useRef(null); // Local RTC peer 연결 객체
  const remoteConnection = useRef(null); // Remote RTC peer 연결 객체

  // WebSocket 및 WebRTC 연결 설정 함수
  const connect = () => {
    // 1. WebSocket 연결 설정
    socket.current = new WebSocket("ws://localhost:8080/ws?user="+email);

    // WebSocket 연결 성공시 상태 업데이트
    socket.current.onopen = () => {
      setConnected(true);
      console.log("websocket connected");
    };

    // WebSocket 메시지 수신 시 처리
    socket.current.onmessage = (event)=>{
      const message = JSON.parse(event.data);
      console.log("Received WebSocket Message: ", message);

      if(message.type === "offer"){
        // 상대방의 SDP Offer를 수신하고, Answer를 생성 후 전송
        remoteConnection.current.setRemoteDescription(new RTCSessionDescription(message));
        remoteConnection.current.createAnswer().then((answer)=> {
          remoteConnection.current.setLocalDescription(answer);
          socket.current.send(
            JSON.stringify({ type: "answer", sdp: answer.sdp, to: message.from})
          );
        });
      }
      else if(message.type === "candidate"){
        // 상대방의 ICE Candidate 수신 시 추가
        const candidate = new RTCIceCandidate({
          sdpMLineIndex: message.sdpMLineIndex,
          candidate: message.candidate,
        });
        remoteConnection.current.addIceCandidate(candidate);
      }
    };

    // WebSocket 연결 종료 시
    socket.current.onclose = () => {
      setConnected(false);
      console.log("WebSocket disconnected");
    }

    // WebSocket 에러 처리
    socket.current.onerror = (error) => {
      console.error("WebSocket error : ", error);
    }

    // WebRTC 피어 연결 구성 설정
    const config = {iceServers: [{ urls: "stun:stun.l.google.com:19302" }]};
    localConnection.current = new RTCPeerConnection(config);
    remoteConnection.current = new RTCPeerConnection(config);

    // Local peer 연결에서 ICE Candidate가 발견되면 Web Socket을 통해 상대방에게 전달
    localConnection.current.onicecandidate = (e) => {
      if(e.candidate){
        console.log("Local ICE Candidate:", e.candidate);
        socket.current.send(
          JSON.stringify({
            type : "candidate",
            candidate: e.candidate.candidate,
            sdpMLineIndex: e.candidate.sdpMLineIndex,
            to: "austinsupra@gmail.com"
          })
        );
      }
    };

    // Remote peer 연결시 ICE Candidate 처리
    remoteConnection.current.onicecandidate = (e) => {
      if(e.candidate){
        console.log("Remote ICE Candidate", e.candidate);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {!connected ? (
        <div>
          <h1>Enter your email to connect</h1>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "10px", margin: "10px", fontSize: "16px" }}
          />
          <button
            onClick={connect}
            style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}
          >
            Connect
          </button>
        </div>
      ) : (
        <div>
          <h2>Connected as {email}</h2>
          <p>WebSocket connected. Ready for WebRTC signaling.</p>
        </div>
      )}
    </div>
  );
};

export default App;
