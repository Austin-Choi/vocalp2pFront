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
  //   const [isEndingCall, setIsEndingCall] = useState(false); // 통화 종료 실행 플래그

  const navigate = useNavigate();
  const location = useLocation(); // 현재 위치에서 state 확인용

  const socket = useRef(null); // Socket.IO client
  const peerConnection = useRef(null); // WebRTC PeerConnection Object
  const localStream = useRef(null); // local audio stream
  const remoteStream = useRef(null); // opponent audio stream

  const isInitialLoad = useRef(true); // 초기 로드 상태를 저장하는 플래그

  // FIXME : 왜 렌더링할때마다 cleanup 해버리는거죠? 분명 return에 넣었는데..
  // 시스템상 어쩔수 없으면 대체 뭘 수정해야 이후
  // 해당 객체를 쓸때 null에 참조하지 못하게 할 수 있을까요..
  useEffect(() => {
    // caller 여부를 확인하여 상태 플래그 설정
    if (location.state) {
      setIsCaller(location.state.isCaller);
      setEmail(location.state.email || ''); // 전달된 이메일 설정
    }
    // 방 링크 설정
    const link = `http://localhost:3000/room/${roomId}`;
    setRoomLink(link); // Caller일 경우 방 링크 저장

    isInitialLoad.current = false;

    return () => {
      if (socket.current || peerConnection.current) {
        handleCleanup(); // 객체가 존재할 때만 cleanup 실행
      }
    };
  }, []);

  // webRTC 연결 해제
  const handleCleanup = () => {
    console.log('handleCleanup 호출됨. 상태 확인:', {
      socket: socket.current,
      peerConnection: peerConnection.current,
    });

    // webRTC 연결 해제
    if (peerConnection.current) {
      // Local 트랙 해제
      localStream.current?.getTracks().forEach(track => track.stop());
      // Remote 트랙 해제
      remoteStream.current?.srcObject
        ?.getTracks()
        .forEach(track => track.stop());

      // peerConnection 닫기
      peerConnection.current.close();
      peerConnection.current = null;
    }
    // Socket.IO 연결 해제
    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
  };

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
    // 이미 종료 중이면 함수 실행 X
    if (!socket.current && !peerConnection.current) {
      console.warn('이미 종료된 상태입니다. 중복 종료 방지');
      return;
    }

    // setIsEndingCall(true);

    if (socket.current) {
      socket.current.emit('leave', { roomId });
      // 서버로 disconnect-call 전송
      socket.current.emit('disconnect-call', { roomId });
    }

    // 사용자에게 종료 알림
    alert('통화가 종료되었습니다. 3초 후 메인 페이지로 돌아갑니다.');

    // webRTC와 Socket.IO 모두 정리
    handleCleanup();
    setInCall(false);

    setTimeout(() => {
      navigate('/');
    }, 3000);
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
      if (event.candidate && socket.current) {
        socket.current.emit('ice-candidate', {
          candidate: event.candidate,
          roomId,
        });
      } else {
        console.warn(
          'ICE candidate를 전송할 수 없습니다. socket이 해제되었습니다.'
        );
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
      // response와 response.data가 존재하는지 체크
      if (response && response.data) {
        setMessage(response.data.result);
      } else {
        setMessage('방 입장에 실패했습니다: 올바르지 않은 응답입니다.');
      }

      setInCall(true);

      socket.current = io('http://localhost:9092'); // 시그널링 서버 연결
      socket.current.on('connect', () => {
        console.log('Socket.IO 연결 성공');
        // 1. Socket 연결 후 WebRTC 초기화
        // SDP, ICE 후보를 교환하기 위해 Signaling Server 연결
        initWebRTC();
      });

      // 연결이 끊어졌을 때 로그 출력 및 상태 초기화
      socket.current.on('disconnect', () => {
        console.log('Socket.IO 연결이 끊어졌습니다.');
        socket.current = null; // 연결이 끊어졌을 때 socket 객체를 초기화
      });

      // Socket이 제대로 초기화되었는지 확인 후 join 이벤트 전송
      if (socket.current) {
        socket.current.emit('join', { roomId, email });
      } else {
        console.error('Socket이 초기화되지 않았습니다.');
      }

      // 2. Socket 이벤트 리스너 등록
      socket.current.on('offer', handleReceiveOffer);
      socket.current.on('answer', handleReceiveAnswer);
      socket.current.on('ice-candidate', handleNewIceCandidate);

      await initWebRTC();

      // 3. CreateOffer 호출해서 Offer SDP 생성 및 전송
      if (isCaller) {
        await createOffer();
      }
    } catch (error) {
      if (error.response) {
        // 서버가 응답했지만 4xx, 5xx 에러일 경우
        setMessage(
          '방 입장에 실패했습니다: ' +
            (error.response.data?.result || error.response.statusText)
        );
        console.error('API 요청 실패 (서버 에러):', error.response);
      } else if (error.request) {
        // 요청이 전송되었지만 응답이 없을 경우
        setMessage('방 입장에 실패했습니다: 서버에서 응답이 없습니다.');
        console.error('API 요청 실패 (요청 전송됨, 응답 없음):', error.request);
      } else {
        // 그 외의 요청 설정 오류 등
        setMessage('방 입장에 실패했습니다: ' + error.message);
        console.error('API 요청 설정 오류:', error.message);
      }
    }
  };
  return (
    <div>
      <h2>Room ID: {roomId}</h2>
      <h3>{isCaller ? '당신은 Caller입니다.' : '당신은 Callee입니다.'}</h3>
      {!inCall ? (
        <>
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
