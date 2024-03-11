const cron = require('node-cron');
const mysql = require('mysql2/promise');
const moment = require('moment-timezone');

// MariaDB 연결 정보
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'news_final',
};

// 사용자가 저장한 시간대와 스케줄 정보
const userTimezone = 'Korea/Seoul'; // 사용자의 시간대
const userScheduledTime = '30 8 * * *'; // 예시: 매일 오전 8시 30분

// 데이터 전송 함수
async function sendUserData() {
  try {

   

    // MariaDB 연결
    const connection = await mysql.createConnection(dbConfig);

    // 사용자의 데이터를 가져오는 쿼리 작성
    const query = 'SELECT * FROM users WHERE user_id = ?';
    // const userId = 1; // 사용자 ID 예시, 실제 사용자 ID로 변경 필요

    // 사용자의 데이터를 조회
    const [rows] = await connection.execute(query, [userId]);

    // 여기에서 데이터 전송 로직을 작성 (rows에 조회된 데이터가 있음)

    // 연결 종료
    await connection.end();

    console.log('데이터 전송 작업 실행 시간:', moment().tz(userTimezone).format());
  } catch (error) {
    console.error('데이터 전송 중 오류 발생:', error);
  }
}

// 사용자의 시간대 및 스케줄 정보를 기반으로 스케줄러 설정
cron.schedule(userScheduledTime, () => {
  // 사용자의 시간대로 시간을 변환하여 스케줄된 작업 실행
  const scheduledTime = moment().tz(userTimezone).format();
  console.log('스케줄러에 등록된 시간:', scheduledTime);

  // 데이터 전송 함수 호출
  sendUserData();
});
