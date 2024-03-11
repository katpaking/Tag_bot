import mysql.connector
from sklearn.feature_extraction.text import TfidfVectorizer
from eunjeon import Mecab
from collections import Counter
import sys
import re
import numpy as np
import codecs

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

sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# MeCab을 사용한 형태소 분석기 초기화
mecab = Mecab()


# 불용어 처리를 위한 불용어 파일 경로
stopwords_path = 'stopwords.txt'

with open(stopwords_path, 'r', encoding='utf-8') as stopwords_file:
    stopwords = set(stopwords_file.read().splitlines())


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
        if node[1].split(',')[0] in ['NNG', 'NNP', 'VV', 'VA', 'VX', 'MAG']:
            result.append(node[0])
            
    return result


if __name__ == "__main__":

# 사용자 ID와 targetId를 커맨드 라인에서 받습니다.
  user_id = sys.argv[1]
  target_id = sys.argv[2]

print(user_id, target_id)

    
# 데이터베이스에서 뉴스 기사와 카테고리 정보 가져오기
def fetch_data_from_database(target_id):
    connection = mysql.connector.connect(**db_config)
    cursor = connection.cursor()
    
    query = "SELECT id, title, content FROM news02 WHERE id = %s"
    cursor.execute(query, (target_id,))
    data = cursor.fetchall()
    connection.close()
    return data


# TF-IDF Vectorizer 정의
tfidf_vectorizer = TfidfVectorizer(tokenizer=tokenize, max_features=1000, token_pattern=None)  # 상위 1000개의 단어만 사용

# 데이터를 문장으로 분리
train_data = fetch_data_from_database(target_id)
texts = [data[2] for data in train_data]  # content를 사용

# TF-IDF Matrix 계산
tfidf_matrix = tfidf_vectorizer.fit_transform(texts)

# 각 문서에서 가장 중요한 단어들의 인덱스를 추출
feature_names = tfidf_vectorizer.get_feature_names_out()



# MariaDB에 사용자 태그 데이터 삽입
def insert_tags_to_database(cursor, user_id, tags):
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
            tag_id_row = cursor.fetchone()
            if tag_id_row is not None:
               tag_id = tag_id_row[0]
            
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
            

# 예시: 모든 뉴스에 대해 태그 추출 및 데이터베이스 저장
connection = mysql.connector.connect(**db_config)
cursor = connection.cursor()



for i, (news_id, title, content) in enumerate(train_data):
    
    tokens_with_pos = tokenize(content)
    print("형태소 분석 결과:", tokens_with_pos)
    
    # 기사 내용에 대해 토큰화 및 전처리를 수행하여 태그 추출
    preprocessed_content = ' '.join(tokenize(content))
    
    # TF-IDF Vectorizer를 사용하여 문서 벡터 생성
    tfidf_vector = tfidf_vectorizer.transform([preprocessed_content])
    
    # 상위 3개의 단어만 사용하여 태그 추출
    sorted_indices = np.argsort(tfidf_vector.toarray().flatten())[::-1][:3]
    tags = [feature_names[idx] for idx in sorted_indices]
    print(tags)
   
    insert_tags_to_database(cursor, user_id, tags)

        
    connection.commit()
    connection.close()

    print("태그가 저장되었습니다.")