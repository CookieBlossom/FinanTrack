# test_check.py
import redis

rut = "21737273-9"
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

respuestas = r.lrange(f"scraper:response:{rut}", 0, -1)
if respuestas:
    for respuesta in respuestas:
        print("📦 Respuesta:", respuesta)
else:
    print("⏳ Aún no hay respuesta")