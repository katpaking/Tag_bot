
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');
const cors = require('cors');


const app = express();

app.use(logger('dev', {}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

const apiRouter = express.Router();
app.use('/api', apiRouter);
app.use(cors());

app.set('port', process.env.PORT || 3002);




const userdataHandler = require('./userdataHandler');

app.get('/log', (req, res) => {
  const targetId = req.query.id || req.query.newsId;
  const targetUrl = req.query.url;
  const userId = req.query.userId;
 
//   let targetTag = req.query.tag;

  if (targetUrl && targetId && userId) {
      // 이 부분에 리다이렉트 또는 다른 처리 로직을 추가하세요
      userdataHandler.saveArticleUrlAndId(targetId, targetUrl, userId);


      /////////////////////////////////////
  const { spawn } = require('child_process');
  const pythonProcess = spawn('python', ['split_news.py', userId, targetId]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

        ///////////////////////////


      res.redirect(targetUrl);
  } else {
      res.status(400).send("Missing 'url', 'id', or 'userId' parameter in the query string.");
  }
});






//발화내용-사용자가 선택한 시간 저장 미들웨어
const saveUserTime = async (req, res, next) => {
    const userRequests = req.body.userRequest;

    try {
        // 발화내용 저장
        if (userRequests) {
            await userdataHandler.saveUserTime(userRequests);
        }
        next(); // 다음 미들웨어로 이동
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
};




apiRouter.post('/timetest', saveUserTime, async function(req, res) {
  console.log("timetest로 POST 요청이 왔습니다:", req.body);

  const responseBody = {
    "version": "2.0",
    "template": {
        "outputs": [
            {
                "simpleText": {
                    "text": "시간을 선택하셨습니다"
                }
            }
        ]
    }
};
  
  
  res.status(200).send(responseBody);
});


const  dataHandler  = require('./dataHandler');



//시작 화면 최신 뉴스
apiRouter.post('/lastNews', async function(req, res) {
    
    try{
    console.log("lastNews POST 요청이 왔습니다:", req.body);
    // 요청으로부터 사용자 정보와 발화 내용 추출
      const userRequest = req.body.userRequest;
    //   if (!userRequest || !userRequest.user || !userRequest.user.id || !userRequest.utterance) {
    //       throw new Error('Invalid user request');
    //   }
      
      const userId = userRequest.user.id;
      const userUtterance = userRequest.utterance;
      

      console.log("발화를 발생시킨 사용자 id: ", userId);
      console.log("사용자의 발화 내용: ", userUtterance);
  
      //사용자 아이디 저장(중복시 저장x)
      await userdataHandler.saveUserId(userId);
      
   
   const newsData = await dataHandler.getLastNews();
   console.log("최신 뉴스 :", newsData);

   
   const basicCardItems = [];

for (const news of newsData) {
    let imageUrl = news.image_url;
    // 이미지 URL이 "N/A"인 경우 대체 이미지로 설정
    if (imageUrl === 'N/A') {
        imageUrl = "https://lh3.googleusercontent.com/proxy/PYelqEOLgWeGwxBW50JdaB80gcXBFE93Fk4QNdp7O3yLboXQDMot_FAzMZccAvtnI9T2MsD5zhcQSh_pYsY6fUAaE2oIVE-APZ2XA7-J33PxrInMPwDH";
    }
    
    const item = {
        "id": news.id,
        
        "title": news.title,
        "description": "최신 뉴스",
        "thumbnail": {
            "imageUrl": imageUrl
        },
        "buttons": [
            {
                "action": "block",
                "label": "요약 보기",
                "blockId": "65e6792ffba01076c726c129",
                "extra": {
                    "newsId": news.id,
                    "newsTitle": news.title
                }
            },
            {
                "action":  "webLink",
                "label": "링크 바로가기",
                "webLinkUrl": `http://106.243.92.221:3002/log?url=${encodeURIComponent(news.link)}&userId=${userId}&newsId=${news.id}`
            },
            
        ],
        
        "id_hidden": true // news.id가 숨겨진 상태로 추가됨
       
    };
    
    basicCardItems.push(item);

    }

    // 주제별 뉴스 보러가기 버튼이 있는 카드 추가
const additionalCard = {
    "id": "additional_card_id", // 추가한 카드의 고유 ID
    "title": "주제별 뉴스 보러 가기", // 카드의 타이틀
    "description": "주제별 뉴스를 확인하려면 아래 버튼을 클릭하세요.", // 카드의 설명
    "thumbnail": {
        "imageUrl": "https://postfiles.pstatic.net/MjAyNDAzMDRfMzkg/MDAxNzA5NTEzMjE1OTAz.tIGeIC7BEr8aymBagLGSs4EkIkpowykN4wjDROqIVmIg.FxNiLRk0fPVbUs0oZvEaGHgOmn_-MzACZ4IYsJjLwlEg.JPEG/KakaoTalk_20240303_160735219.jpg?type=w773"
      },
    "buttons": [
        {
            "action": "block",
            "label": "주제별 뉴스 보러 가기",
            "blockId": "65cf0cab97aba41e92a2c31c"
        }
    ]
};

// basicCardItems 배열에 추가 카드 추가
basicCardItems.push(additionalCard);
  
   // 응답 데이터 구성
   const responseBody = {

    "version": "2.0",
    "template": {
      "outputs": [
        {
          "carousel": {
            "type": "basicCard",
            "items": basicCardItems
           }
        }
      ]
    }
  };     
     // 응답 전송
     res.status(200).send(responseBody);
     
    } catch (error) {
     console.error('Error occurred:', error);
     res.status(500).send('Internal Server Error');
    }
    }); 



//카테고리별 검색하는 뉴스 리스트는 코드 하나로 통일
//newsList 
apiRouter.post('/newsList', async function(req, res) {
    
    try{
    console.log("newsList POST 요청이 왔습니다:", req.body);
    // 요청으로부터 사용자 정보와 발화 내용 추출
      const userRequest = req.body.userRequest;
    //   if (!userRequest || !userRequest.user || !userRequest.user.id || !userRequest.utterance) {
    //       throw new Error('Invalid user request');
    //   }
      
      const userId = userRequest.user.id;
      const userUtterance = userRequest.utterance;
      const blockName = userRequest.block.name;

      console.log("발화를 발생시킨 사용자 id: ", userId);
      console.log("사용자의 발화 내용: ", userUtterance);

      await userdataHandler.saveUserId(userId);
      //사용자가 선택한 블록 이름=발화 내용을 태그로 저장하기
    await dataHandler.saveUserUtteranceBlockNameAndId(userRequest);
   // 사용자의 발화 내용에 관련된 기사를 조회
   const newsData = await dataHandler.selectByUtteranceAndBN(userRequest);
   
   //카테고리 정보 가져오기
   const categories = newsData.map(newsItem => newsItem.category);
   // 중복 제거 및 빈 값 제거
  const uniqueCategories = [...new Set(categories)].filter(Boolean);
  // 카테고리 데이터를 문자열로 변환
  const categoryString = uniqueCategories.join(', ');
   
  console.log(categoryString, " : ", newsData);
  
   // 응답 데이터 구성
   const responseBody = {
       "version": "2.0",
       "template": {
           "outputs": [
               {
                   "listCard": {
                       "header": {
                           "title": `${categoryString} 뉴스`
                       },
                       "items": newsData.map(linkObj => {
                           const itemWithId = {
                               "id": linkObj.id,
                               "title": linkObj.title,
                               "imageUrl": linkObj.image_url,
                               "link": {
                                 "web": `http://106.243.92.221:3002/log?url=${encodeURIComponent(linkObj.link)}&id=${linkObj.id}&userId=${userId}`
                             }
                           };
                           // 반환할 때 id 속성을 삭제합니다.
                           const { id, ...visibleItem } = itemWithId;
                           return visibleItem;
                       })
                   }
               }
           ]
      
       }

   };
  
   // 응답 전송
   res.status(200).send(responseBody);
   
  } catch (error) {
   console.error('Error occurred:', error);
   res.status(500).send('Internal Server Error');
  }
  });


  //전체 검색
  apiRouter.post('/selectAll', async function(req, res) {
    try {
        console.log("selectAll로 POST 요청이 왔습니다:", req.body);

        // 요청으로부터 사용자 정보와 발화 내용 추출
        const userRequest = req.body.userRequest;
        if (!userRequest || !userRequest.user || !userRequest.user.id || !userRequest.utterance) {
            throw new Error('Invalid user request');
        }

        const userId = userRequest.user.id;
        const userUtterance = userRequest.utterance;

        console.log("기사를 선택한 사용자 id: ", userId);
        console.log("사용자의 발화 내용: ", userUtterance);

        //사용자 아이디 저장(중복시 저장x)
        await userdataHandler.saveUserId(userId);
        //사용자 발화 자체 저장
        await userdataHandler.saveUserUtteranceAndId(userRequest);

        // 뉴스 데이터 추출
        const newsData = await userdataHandler.executePythonScriptAndExtractTags(userRequest);
        console.log("태그별 추출된 뉴스 튜플: ", newsData[0]);
        
        const cleanedData = newsData.map(news => news.replace(/\n/g, ''));
        // console.log("개행 문자가 지워진 데이터", cleanedData);

        function parseNewsData(cleanedData) {
            const parsedNews = [];
        
            // 각 뉴스 정보에 대해 반복하여 객체로 변환
            for (const news of cleanedData) {
                // 괄호 안의 내용을 추출
                try{ 
                    // const matches = news.match(/\([^()']*(?:'[^']*'[^()]*)*\)/g);
                    const matches = news.match(/\((?:'[^']*'|"[^"]*"|`[^`]*`|[^()])*\)/g);


                // console.log("matches :", matches);
                if (!matches) {
                    continue; // 매치된 결과가 없으면 다음 뉴스로 넘어감
                }
                
                for (const match of matches) {
                    // 괄호 안의 내용을 쉼표로 분리하여 데이터 추출
                    // const quotedStrings = match.match(/'(?:\\'|[^'])*'/g);
                    // const quotedStrings = match.match(/'(?:\\.|[^'\\])*'/g);
                    const quotedStrings = match.match(/(['"])(?:\\.|(?!\1)[^\\])*\1/g);


                    
                       const data = match.match(/(?:"[^"]*"|'[^']*')|[^,()]+/g).map(entry => entry.replace(/^['"]|['"]$/g, ''));

                    
                    // ID, 제목, 링크, 이미지 URL 추출
                    const id = data[0].replace(/\D/g, ''); // 괄호를 제거하여 숫자만 추출
                    

                    const title = quotedStrings[0].replace(/^['"`]|['"`]$/g, "").replace(/\\'/g, "'");


                    const link = quotedStrings[1].trim().replace(/^'|'$/g, "");
                    
                  
                    const imageUrl = quotedStrings.length > 2 ? quotedStrings[2].trim().replace(/^'|'$/g, "") : '';
                    const categories = quotedStrings[3].trim().replace(/^'|'$/g, "");
      
                    

                    parsedNews.push({
                        id: id,
                        title: title,
                        link: link,
                        imageUrl: imageUrl
                    });
                }
            }catch (error) {
                console.error('Error occurred during parsing news data:', error);
                // 오류가 발생한 경우 해당 뉴스 항목을 건너뜀
            }
        }
        
            return parsedNews;
        }
        
        // 파싱된 뉴스 데이터
        const parsedNewsData = parseNewsData(cleanedData);
        console.log("파싱된 뉴스 : ", parsedNewsData); // 파싱된 뉴스 데이터 확인
        
        let responseBody;

        if (parsedNewsData.length === 0) {
            responseBody = {
                "version": "2.0",
                "template": {
                    "outputs": [
                        {
                            "simpleText": {
                                "text": `${userUtterance} 관련 뉴스를 찾지 못했습니다.`
                            }
                        }
                    ]
                }
            };
        } else {
            // 뉴스 데이터를 파싱하여 리스트 카드의 아이템으로 변환
            const parsedNewsData = parseNewsData(newsData);

            // 응답 데이터 구성
               responseBody = {
                 "version": "2.0",
                 "template": {
                    "outputs": [
                       {
                          "listCard": {
                              "header": {
                                   "title": `${userUtterance} 관련 뉴스`
                              },
                             "items": parsedNewsData.map(news => {
                                 let imageUrl = news.imageUrl;
                                 // 이미지 URL이 "N/A"인 경우 대체 이미지로 설정
                                 if (imageUrl === "N/A") {
                                    imageUrl = "https://lh3.googleusercontent.com/proxy/PYelqEOLgWeGwxBW50JdaB80gcXBFE93Fk4QNdp7O3yLboXQDMot_FAzMZccAvtnI9T2MsD5zhcQSh_pYsY6fUAaE2oIVE-APZ2XA7-J33PxrInMPwDH";
                                }
                                return {
                                    "id": news.id,
                                    "title": news.title,
                                    "imageUrl": imageUrl,
                                    "link": {
                                       "web": `http://106.243.92.221:3002/log?url=${encodeURIComponent(news.link)}&id=${news.id}&userId=${userId}`
                                     }
                            };
                        })
                        }
                       }
                      ]
                    }
                };

            // 뉴스 데이터 개수가 5개 미만일 경우, 추가적인 응답 구성
    if (parsedNewsData.length < 5) {
        responseBody.template.outputs.push({
            "carousel": {
                "type": "basicCard",
                "items": [
                    {
                        "title": "보여드릴 뉴스가 모자라요..",
                        "description": "다른 뉴스를 보시겠어요?",
                        "thumbnail": {
                            "imageUrl": "https://lh3.googleusercontent.com/proxy/PYelqEOLgWeGwxBW50JdaB80gcXBFE93Fk4QNdp7O3yLboXQDMot_FAzMZccAvtnI9T2MsD5zhcQSh_pYsY6fUAaE2oIVE-APZ2XA7-J33PxrInMPwDH"
                        },
                        "buttons": [
                            {
                                "action": "block",
                                "label": "주제별 뉴스 보러 가기",
                                "blockId": "65cf0cab97aba41e92a2c31c"
                            }
                        ]
                    }
                ]
            }
        });
    }

        }
        
        // 응답 전송
        res.status(200).send(responseBody);
    
    } catch (error) {
        // 오류 발생 시 처리
        console.error('Error occurred:', error);
        res.status(500).send('Internal Server Error');
    }
});



//사용자 추천 뉴스 리스트
apiRouter.post('/sugNews', async function(req, res) {
    
    try{
    console.log("sugNews POST 요청이 왔습니다:", req.body);
    // 요청으로부터 사용자 정보와 발화 내용 추출
      const userRequest = req.body.userRequest;
      
      const userId = userRequest.user.id;
      const userUtterance = userRequest.utterance;
      

      console.log("발화를 발생시킨 사용자 id: ", userId);
      console.log("사용자의 발화 내용: ", userUtterance);
  
      //사용자 아이디 저장(중복시 저장x)
      await userdataHandler.saveUserId(userId);
      
   // 사용자에게 추천할 뉴스 조회
   // 사용자의 발화 내용에 관련된 기사를 조회
const newsData = await dataHandler.suggestNews(userRequest);
console.log("추천 뉴스 :", newsData);


let responseBody;

const basicCardItems = [];

if (newsData && newsData.length > 0) {
    for (const news of newsData) {
        let imageUrl = news.image_url;
    // 이미지 URL이 "N/A"인 경우 대체 이미지로 설정
    if (imageUrl === 'N/A') {
        imageUrl = "https://lh3.googleusercontent.com/proxy/PYelqEOLgWeGwxBW50JdaB80gcXBFE93Fk4QNdp7O3yLboXQDMot_FAzMZccAvtnI9T2MsD5zhcQSh_pYsY6fUAaE2oIVE-APZ2XA7-J33PxrInMPwDH";
    }
        const item = {
            "id": news.id,
            "title": news.title,
            "description": "당신만을 위한 뉴스",
            "thumbnail": {
                "imageUrl": imageUrl
            },
            "buttons": [
                {
                    "action": "block",
                    "label": "요약 보기",
                    "blockId": "65e6792ffba01076c726c129",
                    "extra": {
                        "newsId": news.id,
                        "newsTitle": news.title
                    }
                },
                {
                    "action": "webLink",
                    "label": "링크 바로가기",
                    "webLinkUrl": `http://106.243.92.221:3002/log?url=${encodeURIComponent(news.link)}&userId=${userId}&newsId=${news.id}`
                }
            ],

            "id_hidden": true // news.id가 숨겨진 상태로 추가됨
            
        };
        // console.log("item :", item)
        basicCardItems.push(item);
    }
} 
    // 추천할 뉴스가 없을 때 대신 대체 카드를 보여줌
    if (basicCardItems.length === 0) {
    responseBody = {
        "version": "2.0",
        "template": {
            "outputs": [
                {
                    "basicCard": {
                        "title": "Ooops! 추천할 뉴스가 없어요...",
                        "description": "다른 뉴스를 보시겠어요?",
                        "thumbnail": {
                            "imageUrl": "https://cdn.topclass.chosun.com/news/photo/201812/4913_16864_1900.jpg"
                        },
                        "buttons": [
                            {
                                "action": "block",
                                "label": "주제별 뉴스 보러 가기",
                                "blockId": "65cf0cab97aba41e92a2c31c"
                            }
                        ]
                    }
                }
            ]
        }
    };
} else if (basicCardItems.length < 5) {
    // basicCardItems의 길이가 1개 이상 5개 미만인 경우
    // 추가로 카드를 생성하여 넣어줌
    basicCardItems.push({
        "title": "추천할 뉴스가 모자라요..",
        "description": "다른 뉴스를 보시겠어요?",
        "thumbnail": {
            "imageUrl": "https://lh3.googleusercontent.com/proxy/PYelqEOLgWeGwxBW50JdaB80gcXBFE93Fk4QNdp7O3yLboXQDMot_FAzMZccAvtnI9T2MsD5zhcQSh_pYsY6fUAaE2oIVE-APZ2XA7-J33PxrInMPwDH"
        },
        "buttons": [
            {
                "action": "block",
                "label": "주제별 뉴스 보러 가기",
                "blockId": "65cf0cab97aba41e92a2c31c"
            }
        ]
    });
}

// 응답 데이터 구성
responseBody = responseBody || {
    "version": "2.0",
    "template": {
        "outputs": [
            {
                "carousel": {
                    "type": "basicCard",
                    "items": basicCardItems
                }
            }
        ]
    }
};

     // 응답 전송
     res.status(200).send(responseBody);
     
    } catch (error) {
     console.error('Error occurred:', error);
     res.status(500).send('Internal Server Error');
    }
    }); 


//뉴스 요약
apiRouter.post('/sumNews', async function(req, res) {
    
        try{
        console.log("sumNews POST 요청이 왔습니다:", req.body);

        const userRequest = req.body.userRequest;
    //   if (!userRequest || !userRequest.user || !userRequest.user.id || !userRequest.utterance) {
    //       throw new Error('Invalid user request');
    //   }
      
         const userId = userRequest.user.id;
        
        const clientExtra = req.body.action.clientExtra;
        const newsId = clientExtra ? clientExtra.newsId : null;
        console.log("받은 newsId:", newsId);
        const newsTitle = clientExtra ? clientExtra.newsTitle : null;
        console.log("받은 newsTitle:", newsTitle);

        const summaryData = await dataHandler.newSummary(newsId);
        console.log("뉴스 요약: ", summaryData);
        const Link = await dataHandler.newsLink(newsId);
        // console.log("Link: ", Link);

        // 첫 번째 객체의 link와 tag를 가져옴
        const firstItem = Link[0] || { link: ""}; // 첫 번째 객체가 없으면 기본값으로 빈 문자열 사용

        function truncateText(text, maxLength) {
            if (text.length > maxLength) {
                return text.substring(0, maxLength) + '...';
            } else {
                return text;
            }
        }

        const maxLength = 250; // 표시할 최대 길이를 지정합니다.
        const truncatedSummary = truncateText(summaryData, maxLength);

      // 여기서 newsId를 사용하여 요약된 뉴스 생성 또는 처리
       // 응답 데이터 구성
       const responseBody = {
        "version": "2.0",
        "template": {
          "outputs": [
            {
              "textCard": {
                "title": newsTitle,
                "description": truncatedSummary,
                "buttons": [
                    {
                        "action":  "webLink",
                        "label": "전문 보러 가기",
                        "webLinkUrl": `http://106.243.92.221:3002/log?url=${encodeURIComponent(firstItem.link)}&userId=${userId}&newsId=${newsId}`
                    },
                  {
                    "action": "block",
                    "blockId": "65cf0cab97aba41e92a2c31c",
                    "label": "주제별 뉴스 보러 가기"
                  }
                ]
              }
            }
          ]
        }
      };
      
       // 응답 전송
       res.status(200).send(responseBody);
       
      } catch (error) {
       console.error('Error occurred:', error);
       res.status(500).send('Internal Server Error');
      }
      });

//포트 실행
app.listen(app.get('port'), () => {
  console.log(app.get('port'), '번 포트에서 대기중');
});