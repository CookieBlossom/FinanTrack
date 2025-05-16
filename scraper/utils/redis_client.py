import json

def get_task(redis_client, queue_name):
    task = redis_client.blpop(queue_name, 0)
    return task[1] if task else None

def store_result(redis_client, key, result_dict):
    redis_client.rpush(key, json.dumps(result_dict))