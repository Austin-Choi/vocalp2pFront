import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';

function RoomPage() {
  const { roomId } = useParams(); // url에서 roomId 추출
  const [email, setEmail] = useState(''); // 이메일 입력 상태
  const [inCall, setInCall] = useState(false); // 현재 통화중인지 여부
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const socket = useRef(null); // Socket.IO client
  const peerConnection = useRef(null); // WebRTC PeerConnection Object
  const localStream = useRef(null); // local audio stream
  const remoteStream = useRef(null); // opponent audio stream

  // WebRTC 연결 초기화
  const initWebRTC = async () => {
    localStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

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
    peerConnection.current.close();
    setInCall(false);
    navigate('/');
  };

  // 방에 입장하고 Socket.IO 초기화
  const handleJoinRoom = async () => {
    try {
      const response = await axios.post(
        'http://localhost:8080/api/rooms/room/${roomId}',
        null,
        { params: { email } }
      );
      setMessage(response.data.result);
      setInCall(true);

      // Socket.IO 초기화 및 이벤트 리스터 등록
      socket.current = io('http://localhost:9092'); // 시그널링 서버 연결
      socket.current.emit('join', { roomId, email });

      socket.current.on('offer', handleReceiveOffer);
      socket.current.on('answer', handleReceiveAnswer);
      socket.current.on('ice-candidate', handleNewIceCandidate);

      initWebRTC();
    } catch (error) {
      setMessage('방 입장에 실패했습니다: ' + error.response.data.result);
    }
  };
  return (
    <div>
      <h2>Room ID : {roomId}</h2>
      {!inCall ? (
        <>
          <input
            type="emial"
            placeholder="이메일 입력"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button type="button" onClick={handleJoinRoom}>
            통화 시작
          </button>
        </>
      ) : (
        <>
          <h3>통화중</h3>
          <audio ref={remoteStream} autoPlay />
          <button onClick={handleEndCall}>통화 종료</button>
        </>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}

export default RoomPage;
