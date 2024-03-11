// dataHandler.js

const db = require('./databaseHandler');

const userdataHandler = require('./userdataHandler');


//가장 최신 기사 5개 가져오는 함수
const getLastNews = () => {
    return new Promise((resolve, reject) => {
        const selectquery = 
        'SELECT n.id, n.title, n.link, n.image_url, c.name AS category FROM news02 n JOIN categories c ON n.category_id = c.id ORDER BY n.provided_time DESC LIMIT 5';

        db.executeQuery(selectquery, (error, results) => {
            if (error) {
                console.error('MySQL 쿼리 실행 에러:', error);
                reject(error);
                return;
            }
            resolve(results);
            
        });
    });
};
        
    


//발화내용 및 이동한 블록 이름을 태그로 저장
const saveUserUtteranceBlockNameAndId = (userRequests) => {
    const userUtterance = userRequests.utterance || userRequests.block.name;
    const userId = userRequests.user.id;

    const selectQuery = `
        SELECT count FROM tag WHERE user_id = ? AND tags = ?;
    `;

    const updateQuery = `
        UPDATE tag SET count = ? WHERE user_id = ? AND tags = ?;
    `;

    const insertQuery = `
        INSERT INTO tag (user_id, tags, count) VALUES (?, ?, ?);
    `;

    // 쿼리 실행
    db.executeQuery(selectQuery, [userId, userUtterance], (queryError, selectResults) => {
        if (queryError) {
            console.error('Error selecting tag:', queryError);
        } else {
            // selectResults를 이용해 count 값을 가져와서 적절한 처리를 수행합니다.
            const count = selectResults[0]?.count || 0; // 결과가 없을 경우 기본값으로 0을 사용합니다.

            if (count > 0) {
                // count 값을 이용해 updateQuery를 실행합니다.
                db.executeQuery(updateQuery, [count + 1, userId, userUtterance], (updateError, updateResults) => {
                    if (updateError) {
                        console.error('Error updating tag:', updateError);
                    } else {
                        console.log('Tag updated successfully');
                    
                        // 처리 코드를 여기에 추가합니다.
                    }
                });
            } else {
                // count가 0인 경우에만 insertQuery를 실행합니다.
                db.executeQuery(insertQuery, [userId, userUtterance, 1], (insertError, insertResults) => {
                    if (insertError) {
                        console.error('Error inserting tag:', insertError);
                    } else {
                        console.log('Tag inserted successfully');
                        // 처리 코드를 여기에 추가합니다.
                    }
                });
            }
        }
    });
};



// 사용자 발화 내용으로 뉴스 조회
const selectByUtteranceAndBN = (userRequests) => {
    return new Promise((resolve, reject) => {
        // saveUserUtteranceAndId 함수에서 발화 내용을 반환하므로 해당 값을 사용
        userdataHandler.saveUserUtteranceAndId(userRequests)
            .then((userUtterance) => {
        const blockName = userRequests.block.name;
        
        const selectByUtteranceAndBNQuery = `
        SELECT n.id, n.title, n.link, n.image_url, c.name AS category 
        FROM news02 n 
        JOIN categories c ON n.category_id = c.id 
        WHERE c.name LIKE '%${blockName}%' 
        ORDER BY n.provided_time DESC 
        LIMIT 5
    `;


                // console.log('selectByUtteranceAndBNQuery:', selectByUtteranceAndBNQuery);

                db.executeQuery(selectByUtteranceAndBNQuery, (queryError, results) => {
                    if (queryError) {
                        console.error('Error selecting news by user utterances:', queryError);
                        reject(queryError);
                    } else {
                        console.log('Selecting news by user utterances successfully');
                        resolve(results); // 결과를 resolve에 전달
                    }
                });
            });
            })
            .catch((error) => {
                reject(error); // 에러 발생 시 reject
            });
    
};


// 사용자에게 뉴스 추천 VOL.1 (사용자의 탑태그와 일치하는 tag를 news_tag에서 조회, 일치하는 news_id를 찾아 조인한 news02에서 데이터 조회)
const suggestNews = (userRequests) => {
    return new Promise((resolve, reject) => {
        // saveUserUtteranceAndId 함수에서 발화 내용을 반환하므로 해당 값을 사용
        const userId = userRequests.user.id;
        console.log("userId :", userId);

        const topTagsQuery = `
            WITH TopTags AS (
                SELECT
                    utm.user_id,
                    utm.tag_id,
                    ut.tag_name,
                    utm.count
                FROM
                    user_tags_mapping utm
                JOIN
                    user_tags ut ON utm.tag_id = ut.tag_id
                WHERE
                    utm.user_id = '${userId}'
            )
            SELECT
                tag_name
            FROM
                TopTags
            ORDER BY
                count DESC
            LIMIT 1;
        `;
        // 사용자의 가장 많이 사용하는 태그를 찾음
        db.executeQuery(topTagsQuery, (topTagsQueryError, topTags) => {
            if (topTagsQueryError) {
                console.error('Error selecting top tags:', topTagsQueryError);
                reject(topTagsQueryError);
            } else {
                const topTag = topTags[0].tag_name; // 가장 많이 사용하는 태그
                console.log("topTag :", topTag);

                // 태그와 뉴스 정보를 가져오는 쿼리
                const newsInfoQuery = `
                    SELECT MAX(n.id) AS id, n.title, n.link, n.image_url, c.name AS category 
                    FROM news02 n 
                    JOIN categories c ON n.category_id = c.id  
                    JOIN (
                        SELECT news_id
                        FROM news_tags
                        WHERE tag = '${topTag}'
                        ORDER BY news_id DESC
                        LIMIT 5
                    ) nt ON n.id = nt.news_id
                    GROUP BY n.title
    ORDER BY MAX(n.provided_time) DESC;
                `;

                db.executeQuery(newsInfoQuery, (newsErr, newsResults) => {
                    if (newsErr) {
                        console.error(newsErr);
                        reject(newsErr);
                    } else {
                        resolve(newsResults);
                        // console.log("News information:", newsResults);
                    }
                });
            }
        });
    });
};




// //사용자에게 뉴스 추천 VOL.2 (탑태그가 요약된 내용이 포함되어 있는지, 있다면 그 news_id를 가져와 news02에서 조회)

// const suggestNews = (userRequests) => {
//     return new Promise((resolve, reject) => {
//         // saveUserUtteranceAndId 함수에서 발화 내용을 반환하므로 해당 값을 사용
//         const userId = userRequests.user.id;
//         console.log("userId :", userId);

//         const topTagsQuery = `
//             WITH TopTags AS (
//                 SELECT
//                     utm.user_id,
//                     utm.tag_id,
//                     ut.tag_name,
//                     utm.count
//                 FROM
//                     user_tags_mapping utm
//                 JOIN
//                     user_tags ut ON utm.tag_id = ut.tag_id
//                 WHERE
//                     utm.user_id = '${userId}'
//             )
//             SELECT
//                 tag_name
//             FROM
//                 TopTags
//             ORDER BY
//                 count DESC
//             LIMIT 1;
//         `;
//         // 사용자의 가장 많이 사용하는 태그를 찾음
//         db.executeQuery(topTagsQuery, (topTagsQueryError, topTags) => {
//             if (topTagsQueryError) {
//                 console.error('Error selecting top tags:', topTagsQueryError);
//                 reject(topTagsQueryError);
//             } else {
//                 const topTag = topTags[0].tag_name; // 가장 많이 사용하는 태그
//                 console.log("topTag :", topTag);
                
                
//                 //toptag가 요약에 포함되어 있는지 summa_news 조회
//                 const selectByUtteranceAndBNQuery = `
//                     SELECT news_id 
//                     FROM summa_news   
//                     WHERE summary LIKE '%${topTag}%'
//                     LIMIT 5
//                 `;

//                 db.executeQuery(selectByUtteranceAndBNQuery, (err, results) => {
//                     if (err) {
//                         console.error(err);
//                         return;
//                     }else{
//                         const newsIds = results.map(result => result.news_id).join(',');
                        
                        
//                         // news02 테이블에서 해당 news_id의 정보 가져오기
//                         const newsInfoQuery = `
//                             SELECT n.id, n.title, n.link, n.image_url, c.name AS category 
//                             FROM news02 n 
//                             JOIN categories c ON n.category_id = c.id  
//                             WHERE n.id IN (${newsIds})
//                             ORDER BY n.provided_time DESC
//                         `;
                        
//                         db.executeQuery(newsInfoQuery, (newsErr, newsResults) => {
//                             if (newsErr) {
//                                 console.error(newsErr);
//                                 reject(newsErr);
//                             } else {
//                                 resolve(newsResults);
                                
//                                 console.log("News information:", newsResults);
//                             }
//                         });
//                     }
//                 });
//             }
//         });
//     });
// };
        


// 4줄 또는 5줄로 요약된 텍스트를 가져와 한 번 더 2줄로 요약하는 함수
const summarizeTwice = (summary) => {
    // 첫 번째 요약
    const lines = summary.split('.'); // 마침표를 기준으로 문자열을 분할합니다.
    // console.log("lines: ", lines);
    const firstSummary = lines[0].trim(); // 첫 번째 줄을 선택하고 좌우 공백을 제거합니다.
    const secondSummary = lines[1].trim(); // 첫 번째 줄을 선택하고 좌우 공백을 제거합니다.
    const lastLineIndex = lines.length - 1;
   const lastLine = lines[lastLineIndex].trim(); // 마지막 줄을 선택하고 좌우 공백을 제거합니다.
   const lastSummary = lastLine !== '' ? lastLine : lines[lastLineIndex - 1].trim(); // 마지막 줄이 비어 있으면 그 앞 줄을 선택합니다.

    const finalSummary = firstSummary + ' ' + secondSummary + ' ' + lastSummary; // 첫 번째 줄과 마지막 줄을 합칩니다.
    // console.log("finalSummary: ", finalSummary);
    

    return finalSummary;
};




//받아온 뉴스 id로 summa_news 조회해 추출
const newSummary = (newsId) => {
    return new Promise((resolve, reject) => {
        selectQuery = 'SELECT summary FROM summa_news WHERE news_id = ?';

        db.executeQuery(selectQuery, [newsId], (error, results) => {
            if (error) {
                console.log('Error checking newsId: ', error);
                reject(error);
                return;
            }
            if (results.length === 0) {
                console.error('News summary not found for newsId:', newsId);
                resolve(null); // 해당하는 뉴스 요약이 없는 경우 null 반환
                return;
            }
            const summary = results[0].summary;
            console.log('select summary successfully!');

            // 두 번의 요약을 수행
            const twiceSummarizedSummary = summarizeTwice(summary);
            
            resolve(twiceSummarizedSummary); // 요약 반환
        });
    });
};


//받아온 뉴스 id로 summa_news 조회해 추출
const newsLink = (newsId) => {
    return new Promise((resolve, reject) => {
        selectQuery = 'SELECT link FROM news02 WHERE id = ?';

        db.executeQuery(selectQuery, [newsId], (error, results) => {
            if (error) {
                console.log('Error checking newsId: ', error);
                reject(error);
                return;
            }
            if (results.length === 0) {
                console.error('Link not found for newsId:', newsId);
                resolve(null); // 해당하는 뉴스 요약이 없는 경우 null 반환
                return;
            }
            resolve(results); // 링크와 태그 반환
            
        });
    });
};
  

// Export the arrays for external use
module.exports = {
    getLastNews,
    saveUserUtteranceBlockNameAndId,
    selectByUtteranceAndBN,
    suggestNews,
    newSummary,
    newsLink,

};
         
    