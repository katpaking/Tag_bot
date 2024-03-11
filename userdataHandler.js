const express = require('express');
const router = express.Router();
const axios = require('axios');

const app = express();

// userdataHandler.js

const dbHandler = require('./userdatabaseHandler');



const isValidInput = (input) => {
    // 이모지와 같은 특수 문자가 포함된 입력이 있는지 확인합니다.
    // 여기서는 이모지만 체크하는 예시를 보여줍니다.
    return !/[\uD800-\uDBFF][\uDC00-\uDFFF]/g.test(input); // 이모지가 없는 경우 true 반환
};


//사용자 발화와 id 데이터 저장(블록이름 포함)
const saveUserUtteranceAndId = (userRequests) => {
    return new Promise((resolve, reject) => {

        // 사용자의 발화 내용(그냥 쳤을 때)과 선택한 카테고리(일단 블록 이름)를 배열로 변환
        // 사용자의 응답 또는 선택한 카테고리 데이터를 배열로 변환
        const utteranceAndIdData  = Array.isArray(userRequests)
    ? userRequests.map((request) => [request.utterance || request.block.name, request.user.id])
    : [[userRequests.utterance || userRequests.block.name, userRequests.user.id]];

     // 유효한 입력만 필터링하여 저장합니다.
     const filteredData = utteranceAndIdData.filter(([utterance]) => isValidInput(utterance));

     if (filteredData.length === 0) {
         console.log('No valid input to save');
         resolve(null); // 유효한 입력이 없는 경우 저장하지 않고 종료합니다.
         return;
     }

      const insertUtteranceAndIdQuery = 'INSERT INTO user_data (utterance, user_id) VALUES ?';

      dbHandler.executeQuery(insertUtteranceAndIdQuery, [utteranceAndIdData], (queryError, results) => {
        if (queryError) {
            console.error('Error inserting user utterances:', queryError);
            reject(queryError);
        } else {
            console.log('User utterances inserted successfully');

            // 사용자 발화 내용을 데이터베이스에서 조회하여 반환
            const selectUtteranceQuery = 'SELECT utterance FROM user_data WHERE id = ?';
            dbHandler.executeQuery(selectUtteranceQuery, [results.insertId], (selectError, selectResults) => {
                if (selectError) {
                    console.error('Error selecting user utterance:', selectError);
                    reject(selectError);
                } else {
                    const userUtterance = selectResults[0]?.utterance;
                    resolve(userUtterance);
               }
           });
           
           //resolve();
    }
});
});
};

//사용자의 아이디를 users로 저장
const saveUserId = (userId) => {
    // 이미 존재하는지 확인하는 쿼리
    const checkQuery = 'SELECT * FROM users WHERE user_id = ?';

    dbHandler.executeQuery(checkQuery, [userId], (error, results) => {
        if (error) {
            console.error('Error checking userId:', error);
            return;
        }

        // 이미 존재하는 사용자 ID가 없는 경우에만 새로운 사용자 ID 저장
        if (results.length === 0) {
            const insertQuery = 'INSERT INTO users (user_id) VALUES (?)';

            dbHandler.executeQuery(insertQuery, [userId], (insertError, insertResults) => {
                if (insertError) {
                    console.error('Error saving userId:', insertError);
                    return;
                }
                console.log('userId saved successfully');
            });
        } else {
            console.log('userId already exists');
        }
    });
};



//사용자가 클릭한 링크의 news의 id와 url을 사용자 id와 함께 저장
const saveArticleUrlAndId = (userId, id, url) => {
    const insertQuery = `INSERT INTO saved_articles (news_id, url, user_id) VALUES ('${userId}', '${id}', '${url}')`;

    dbHandler.executeQuery(insertQuery, (error, results) => {
        if(error) {
            console.error('Error saving selected article:', error);
        }else{
            console.log('selected article saved successfully');
           
        }
    });
    
};




//사용자의 발화 내용을 쪼개어 조회하고 저장하는 파이썬 스크립트 실행
const executePythonScriptAndExtractTags = (userRequest) => {
    return new Promise((resolve, reject) => {

        if (!userRequest || !userRequest.user || !userRequest.user.id || !userRequest.utterance) {
             reject('User ID or utterance is missing');
            return;
        }
            
        const userId = userRequest.user.id;
        const utterance = userRequest.utterance;


        const { spawn } = require('child_process');
        const pythonProcess = spawn('python', ['split_utterance.py', userId, utterance]);
  
        let newsArray = [];
  
        pythonProcess.stdout.on('data', (data) => {
            // 데이터를 배열에 추가
            newsArray.push(data.toString().trim());
            // console.log(newsArray);
        });
  
        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
  
        pythonProcess.on('close', async (code) => {
            console.log(`child process exited with code ${code}`);
            
            // // 처리된 태그 데이터 출력
            // console.log('newsArray: ', newsArray);
  
           
            resolve(newsArray);
        });
    });
};



//사용자 발화 데이터 정확히는 사용자가 선택한 시간으로서 저장
const saveUserTime = (userRequests) => {
    return new Promise((resolve, reject) => {

        // 사용자의 발화 내용(그냥 쳤을 때)과 선택한 시간(일단 블록 이름)를 배열로 변환
        // 사용자의 응답 또는 선택한 시간(블록) 데이터를 배열로 변환
        const userTimeData = Array.isArray(userRequests)
            ? userRequests.map((request) => {
                // 사용자의 발화에서 시간을 추출하여 24시간 형식으로 변경
                let userTime = request.utterance || request.block.name;
                userTime = convertTo24HourFormat(userTime); // 시간 형식 변환
                return [userTime, request.user.id];
            })
            : [[convertTo24HourFormat(userRequests.utterance || userRequests.block.name), userRequests.user.id]];

        // 데이터베이스에 저장하는 쿼리 실행
        const insertTimeQuery = 'INSERT INTO user_data (users_time, user_id) VALUES ?';

        dbHandler.executeQuery(insertTimeQuery, [userTimeData], (queryError, results) => {
            if (queryError) {
                console.error('Error inserting user utterances:', queryError);
                reject(queryError);
            } else {
                console.log('User utterances inserted successfully');
                resolve();
            }
        });
    });
};


// 시간을 24시간 형식으로 변환하는 함수
function convertTo24HourFormat(timeString) {
    // 예시: '오전 9시' => '09:00', '오후 2시' => '14:00' 형식으로 변환
    // 시간을 추출하기 위해 정규 표현식 사용
    const regex = /([0-9]{1,2})시/g;
    const match = regex.exec(timeString);

    if (match) {
        const hour = parseInt(match[1]);
        const isAM = timeString.includes('오전');

        // 오전이면 시간 그대로, 오후면 12를 더해서 24시간 형식으로 변환
        let hour24 = isAM ? hour : hour + 12;

        // 시간을 2자리로 표현하도록 포맷팅
        hour24 = hour24.toString().padStart(2, '0');

        return hour24 + ':00'; // 분은 00으로 설정
    } else {
        // 매치되는 시간이 없으면 기본값 반환
        return timeString;
    }
}



module.exports = {
    // saveUserUtterance,
    saveUserId,
    saveUserUtteranceAndId,
    saveUserTime,
    saveArticleUrlAndId,

    executePythonScriptAndExtractTags,

    // insertOrUpdate,
};
