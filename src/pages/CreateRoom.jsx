import { useState } from 'react';
import axios from 'axios';

function CreateRoom() {
  const [email, setEmail] = useState('');
  const [roomUrl, setRoomUrl] = useState('');

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
      <button onClick={handleCreateRoom}>방 생성</button>

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
