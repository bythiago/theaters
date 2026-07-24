from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_URL = 'https://api-content.ingresso.com/v0'
PARTNERSHIP = 'home'
HEADERS = {'User-Agent': 'Mozilla/5.0'}


def proxy(path):
    sep = '&' if '?' in path else '?'
    url = f'{BASE_URL}/{path}{sep}partnership={PARTNERSHIP}'
    r = requests.get(url, headers=HEADERS, timeout=10)
    r.raise_for_status()
    return jsonify(r.json())


@app.get('/theaters')
def theaters():
    return proxy('theaters')


@app.get('/theaters/city/<city_id>')
def theaters_by_city(city_id):
    return proxy(f'theaters/city/{city_id}')


@app.get('/sessions/city/<city_id>/theater/<theater_id>')
def sessions(city_id, theater_id):
    return proxy(f'sessions/city/{city_id}/theater/{theater_id}')


@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_frontend(path):
    if os.path.exists(path):
        return send_from_directory('.', path)
    return send_from_directory('.', 'index.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
