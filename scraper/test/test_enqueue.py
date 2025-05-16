import redis
import json

r = redis.Redis(host='localhost', port=6379, decode_responses=True)

payload = {
    "site": "banco_estado",
    "rut": "21737273-9",
    "password": "coom004",
}

r.rpush("scraper:task", json.dumps(payload))
print("✅ Tarea enviada a Redis")