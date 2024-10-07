import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function CreateRoom() {
  const [email, setEmail] = useState('');
  const [roomUrl, setRoomUrl] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    try {
      const response = await axios.post(
        'http://localhost:8080/api/rooms',
        null,
        {
          params: { callerEmail: email },
        }
      );
      setRoomUrl(response.data.result);

      // 방 생성후 caller로 입장하여 RoomPage로 이동, isCaller 플래그 전달
      // callee는 createRoom을 거쳐서 오는게 아니라 바로 링크로 타고 들어오므로
      // isCaller를 true로 가지고 들어올 수 없음.
      navigate(roomUrl, { state: { isCaller: true } });
    } catch (error) {
      console.error('방 생성중 오류 발생', error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>방 생성</h2>
      <input
        type="email"
        placeholder="이메일 입력"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <button onClick={handleCreateRoom}>방 만들기</button>

      {roomUrl && (
        <div>
          <p>생성된 방 URL: </p>
          <a href={roomUrl} target="_blank" rel="noopener noreferrer">
            {roomUrl}
          </a>
        </div>
      )}
    </div>
  );
}

export default CreateRoom;
