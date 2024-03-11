import sys
import mysql.connector
from eunjeon import Mecab
import re
from collections import Counter
import codecs
import asyncio
import math



# MariaDB 연결 설정
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': '1234',
    'database': 'news_final',
    'port': 3306,
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci'
}

# MeCab을 사용한 형태소 분석기 초기화
mecab = Mecab()

# 불용어 처리를 위한 불용어 파일 경로
stopwords_path = 'stopwords.txt'

# 불용어 로드
with open(stopwords_path, 'r', encoding='utf-8') as stopwords_file:
    stopwords = set(stopwords_file.read().splitlines())

sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# 형태소 분석 함수 정의
def tokenize(text):
    # 이메일 주소 제거
    text = re.sub(r'\S+@\S+', '', text)
    # 기자 이름 제거 (예시)
    text = re.sub(r'기자\s?\w+', '', text)
    # 특수 문자 및 숫자 제거
    text = re.sub(r'[^ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z\s]', '', text)
    
    nodes = mecab.pos(text)
    result = []
    for node in nodes:
        # 품사가 명사(NNG), 고유명사(NNP), 동사(VV), 형용사(VA), 보조동사(VX), 일반부사(MAG) 중 하나이고 불용어가 아닌 경우에만 추가
        if node[1].split(',')[0] in ['NNG', 'NNP', 'VV', 'VA', 'VX', 'MAG'] and node[0] not in stopwords:
            # 형태소와 품사를 튜플 형태로 추가
            result.append(node[0])
    return result


# 0228 백업
# MariaDB에 사용자 태그 데이터 삽입
def insert_user_tags_to_database(cursor, user_id, tags):
    tag_ids = []
    tag_counts = Counter(tags)
    ranked_tags = tag_counts.most_common()  # count가 큰 순서대로 정렬된 리스트
    for i, (tag, count) in enumerate(ranked_tags, start=1):
        # 태그가 이미 존재하는지 확인하고 count 값을 가져옵니다.
        cursor.execute("SELECT count FROM tag WHERE user_id = %s AND tags = %s", (user_id, tag))
        existing_count_row = cursor.fetchone()
        
        if existing_count_row is not None:
            existing_count = existing_count_row[0]
            # 이미 존재하는 경우 해당 태그의 count 값을 업데이트
            updated_count = existing_count + count
            cursor.execute("UPDATE tag SET count = %s WHERE user_id = %s AND tags = %s", (updated_count, user_id, tag))
            
            cursor.execute("SELECT tag_id FROM user_tags WHERE tag_name = %s", (tag,))
            tag_id = cursor.fetchone()[0]
            
            # user_tags_mapping 테이블에 기존 레코드의 count 값을 증가시킴
            cursor.execute("""
                UPDATE user_tags_mapping
                SET count = count + %s
                WHERE user_id = %s AND tag_id = %s
            """, (count, user_id, tag_id))
        
        else:
            # 존재하지 않는 경우 새로운 태그를 추가
            cursor.execute("""
                INSERT INTO tag (user_id, tags, count, ranking)
                VALUES (%s, %s, %s, %s)
            """, (user_id, tag, count, i))
            
            # 새로운 태그를 추가하여 해당 태그의 tag_id를 가져옵니다.
            cursor.execute("""
                  INSERT INTO user_tags (tag_name)
                  VALUES (%s)
                  ON DUPLICATE KEY UPDATE tag_name = VALUES(tag_name)
            """, (tag,))
    
            cursor.execute("SELECT tag_id FROM user_tags WHERE tag_name = %s", (tag,))
            tag_id = cursor.fetchone()[0]
       
       
        # user_tags_mapping 테이블에 새로운 레코드 추가.
            cursor.execute("""
                INSERT INTO user_tags_mapping (user_id, tag_id, count)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE count = count + 1
            """, (user_id, tag_id, 1))



# 사용자 발화 내용을 받아와서 태그로 저장하는 함수
def process_and_save_tags(user_id, user_utterance):
    try:
        
        connection = mysql.connector.connect(**db_config)
        cursors = connection.cursor()

        # 사용자 입력을 토큰화하여 태그 추출
        user_tags = tokenize(user_utterance)
        
        #태그를 데이터베이스에 저장
        insert_user_tags_to_database(cursors, user_id, user_tags)
        
        connection.commit()
        cursors.close()  # 커서 닫기
        connection.close()

        print(user_tags)
        # print("태그가 추출되었습니다.")

        return user_tags  # 추출된 태그 반환
        
    except Exception as e:
        print("Error:", e)
        return []  # 에러 발생 시 빈 리스트 반환
    


#####################################################################


def select_news_by_tags(user_tags):
    connection = mysql.connector.connect(**db_config)
    cursor = connection.cursor()

    all_news_data = []

    try:
        total_tags = len(user_tags)
        total_news_count = 5  # 총 뉴스 개수는 5로 가정

    # 각 태그별로 가져와야 할 뉴스 개수 계산
        news_count_per_tag_list = []
        for index, tag in enumerate(user_tags):
        # 현재 태그에 대한 가져와야 할 뉴스 개수 계산
             news_count_for_current_tag = total_news_count / total_tags
            #  news_count_for_current_tag = math.ceil(news_count_for_current_tag)  # 올림
             news_count_for_current_tag = max(math.ceil(news_count_for_current_tag), 1)  # 1보다 작으면 1로 설정
        # 마지막 태그 처리
             if index == total_tags - 1:
                # news_count_for_current_tag = total_news_count - sum(news_count_per_tag_list)
                news_count_for_current_tag = max(total_news_count - sum(news_count_per_tag_list), 1)

             news_count_per_tag_list.append(news_count_for_current_tag)
            #  print(news_count_per_tag_list)
             
           
             cursor.execute(f"""
                SELECT n.id, n.title, n.link, n.image_url, c.name AS category
                FROM news02 n
                JOIN categories c ON n.category_id = c.id
                WHERE (c.name LIKE '%{tag}%' OR n.title LIKE '%{tag}%' OR n.content LIKE '%{tag}%')
                  ORDER BY 
                    CASE 
                        WHEN c.name LIKE '%{tag}%' THEN 1 
                        WHEN n.title LIKE '%{tag}%' THEN 2
                        ELSE 3
                    END,
                    n.provided_time DESC
                LIMIT {news_count_for_current_tag}
            #  """)
            
             tag_news_data = cursor.fetchall()
        
             
             all_news_data.extend(tag_news_data)
 
             unique_news_data = list(set(all_news_data))

        return unique_news_data
    
    except Exception as e:
        print(f"An error occurred: {e}")
        return None

    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    # 사용자 발화 내용으로부터 받아온 태그
    user_id = sys.argv[1]
    user_utterance = sys.argv[2]
    
    # 사용자 발화 내용을 태그로 변환
    user_tags = process_and_save_tags(user_id, user_utterance)
    
    # 뉴스 조회 및 출력
    news_data = select_news_by_tags(user_tags)
    for news in news_data:
        print(news)