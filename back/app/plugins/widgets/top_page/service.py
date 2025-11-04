"""Service logic for the Top Page widget.
가장 많이 조회된 페이지와 통계 수를 InfluxDB에서 집계합니다.
"""

from __future__ import annotations
from typing import Any, Dict, List
from influxdb_client_3 import InfluxDBClient3 

# 재사용을 위해 수집 모듈의 설정을 참조합니다.
from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_BUCKET

def get_top_pages(limit: int = 5) -> List[Dict[str, Any]]:
    """Return top viewed pages.

        Args:
        limit: 반환할 페이지 수 (기본값: 5)
    
    Returns:
        [
            {"path": "/home", "total_views": 150},
            {"path": "/products", "total_views": 89},
            ...
        ]
    """


    # Initialize influxDB 3.x client with connection parameters
    # InfluxDB 3.x 클라이언트 초기화
    client = InfluxDBClient3(
        host=INFLUX_URL,
        token=INFLUX_TOKEN,
        database=INFLUX_BUCKET
    )

    # SQL Query (InfluxDB 3.x)
    sql_query = f"""
    SELECT
        path,
        SUM(count) AS total_views
    FROM events
    WHERE event_name = 'page_view'
    GROUP BY path
    ORDER BY total_views DESC
    LIMIT {limit}
    """

    try:

        # InfluxDB 3.x returns results as a PyArrow Table
        # InfluxDB 3.x는 PyArrow Table 형식으로 결과를 반환합니다
        table = client.query(query=sql_query, language="sql")

        # Convert PyArrow Table to Python dictionary
        # PyArrow Table을 Python dictionary로 변환
        # Each column is converted to a list: {'path': [...], 'total_views': [...]}
        # 각 컬럼이 리스트 형태로 변환됩니다: {'path': [...], 'total_views': [...]}
        data_dict = table.to_pydict()

        # Create an empty list to store results
        # 결과를 저장할 빈 리스트 생성
        rows: List[Dict[str, Any]] = []

        # Check if data exists (0 if column is empty)
        # 데이터가 있는지 확인 (컬럼이 비어있으면 0)
        if 'path' not in data_dict or len(data_dict['path']) == 0:
            # Retrun empty list if no data
            # 데이터가 없으면 빈 리스트 반환
            return rows
        
        # Get total number of rows
        # 전체 행 개수 확인
        num_rows = len(data_dict['path'])

        # Iterate through rows and convert to dictionary format
        # 각 행을 순회하면서 딕셔너리 형태로 변환
        for i in range(num_rows):
            rows.append({
                "path" : data_dict['path'][i],
                "total_views" : int(data_dict['total_views'][i]),
            })

        return rows
        
    except Exception as e:
        # Log error and return empty list if query execution fails
        # 쿼리 실행 중 오류 발생 시 로깅 및 빈 리스트 반환
        print(f"Error querying InfluxDB: {e}")
        return []

    finally:
        client.close()
