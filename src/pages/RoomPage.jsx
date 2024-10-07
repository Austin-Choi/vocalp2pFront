import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';

function RoomPage() {
  const { roomId } = useParams(); // url에서 roomId 추출
  const [email, setEmail] = useState(''); // 이메일 입력 상태
  const [inCall, setInCall] = useState(false); // 현재 통화중인지 여부
  const [isCaller, setIsCaller] = useState(false); // caller인지 여부 플래그
  const [message, setMessage] = useState('');
  const [roomLink, setRoomLink] = useState(''); // 방 링크 상태
  const [emailEntered, setEmailEntered] = useState(false); // 이메일 입력 완료 여부

  const navigate = useNavigate();
  const location = useLocation(); // 현재 위치에서 state 확인용

  const socket = useRef(null); // Socket.IO client
  const peerConnection = useRef(null); // WebRTC PeerConnection Object
  const localStream = useRef(null); // local audio stream
  const remoteStream = useRef(null); // opponent audio stream

  useEffect(() => {
    // caller 여부를 확인하여 상태 플래그 설정
    if (location.state) {
      setIsCaller(location.state.isCaller);
      setEmail(location.state.email || ''); // 전달된 이메일 설정
    }
    // 방 링크 설정
    const link = `http://localhost:3000/room/${roomId}`;
    setRoomLink(link); // Caller일 경우 방 링크 저장

    socket.current.on('peer-disconnected', () => {
      alert('상대방이 통화를 종료했습니다.');
      // webRTC 연결 해제
      peerConnection.current.close();

      // 2초 후 루트 페이지로 이동
      setTimeout(() => {
        navigate('/');
      }, 2000);
    });

    // cleanup : unmount시 socket 연결 해제
    return () => {
      socket.current.disconnect();
    };
  });

  // 이메일 입력 후 '입력 완료' 누르면 실행
  const handleEmailSubmit = () => {
    if (email.trim()) {
      setEmailEntered(true); // 이메일이 입력 완료되었음을 설정
    }
  };

  // Caller가 Offer SDP를 생성하고 전송
  const createOffer = async () => {
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.current.emit('offer', { sdp: offer, roomId });
  };

  // Callee가 Answer SDP를 생성하고 전송
  const handleReceiveOffer = async ({ sdp }) => {
    await peerConnection.current.setRemoteDescription(
      new RTCSessionDescription(sdp)
    );
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
    socket.current.emit('answer', { sdp: answer, roomId });
  };

  // Caller가 Answer SDP를 수신
  const handleReceiveAnswer = async ({ sdp }) => {
    await peerConnection.current.setRemoteDescription(
      new RTCSessionDescription(sdp)
    );
  };

  // 새로운 ICE 후보 수신
  const handleNewIceCandidate = async ({ candidate }) => {
    await peerConnection.current.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  };

  // 통화 종료 핸들러
  const handleEndCall = () => {
    socket.current.emit('leave', { roomId });
    // 서버로 disconnect-call 전송
    socket.current.emit('disconnect-call', { roomId });
    peerConnection.current.close();
    setInCall(false);
    navigate('/');
  };

  // WebRTC 연결 초기화
  const initWebRTC = async () => {
    localStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    // 1. PeerConnection 객체 초기화
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // local audio stream adding
    localStream.current.getTracks().forEach(track => {
      peerConnection.current.addTrack(track, localStream.current);
    });

    // ICE candidate 수신시 처리
    peerConnection.current.onicecandidate = event => {
      if (event.candidate) {
        socket.current.emit('ice-candidate', {
          candidate: event.candidate,
          roomId,
        });
      }
    };

    // remote audio track 수신시 처리
    peerConnection.current.ontrack = event => {
      remoteStream.current.srcObject = event.streams[0];
    };
  };

  // 방에 입장하고 Socket.IO 초기화
  const handleJoinRoom = async () => {
    try {
      const response = await axios.post(
        `http://localhost:8080/api/rooms/room/join`,
        { roomId, email },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      setMessage(response.data.result);
      setInCall(true);

      // 1. Socket.IO 초기화 및 이벤트 리스너 등록
      // SDP, ICE 후보를 교환하기 위해 Signaling Server 연결
      socket.current = io('http://localhost:9092'); // 시그널링 서버 연결
      socket.current.emit('join', { roomId, email });

      socket.current.on('offer', handleReceiveOffer);
      socket.current.on('answer', handleReceiveAnswer);
      socket.current.on('ice-candidate', handleNewIceCandidate);

      // 2. RTCPeerConnection 초기화
      // : 로컬 미디어 스트림을 설정하고, ICE 후보를 수집하는 역할
      await initWebRTC();

      // 3. CreateOffer 호출해서 Offer SDP 생성 및 전송
      if (isCaller) {
        await createOffer();
      }
    } catch (error) {
      setMessage('방 입장에 실패했습니다: ' + error.response.data.result);
    }
  };
  return (
    <div>
      <h2>Room ID: {roomId}</h2>
      <h3>{isCaller ? '당신은 Caller입니다.' : '당신은 Callee입니다.'}</h3>
      {!inCall ? (
        <>
          {/* 이메일 입력란과 버튼을 조건부로 렌더링 */}
          {!emailEntered ? (
            <>
              <input
                type="email"
                placeholder="이메일 입력"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <button onClick={handleEmailSubmit} disabled={!email}>
                입력 완료
              </button>
            </>
          ) : (
            <button onClick={handleJoinRoom}>입장하기</button>
          )}
        </>
      ) : (
        <>
          <h3>통화 중...</h3>
          <audio ref={remoteStream} autoPlay />
          <button onClick={handleEndCall}>통화 종료</button>
        </>
      )}

      {/* Caller일 경우 방 링크 표시 */}
      {isCaller && roomLink && (
        <div>
          <h3>방 링크:</h3>
          <p>{roomLink}</p>
        </div>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}

export default RoomPage;
