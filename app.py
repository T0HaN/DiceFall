from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import random
import json
import string

app = Flask(__name__)
app.secret_key = 'dicefall_secret_key_change_in_production'
socketio = SocketIO(app, cors_allowed_origins="*")

# Хранилище данных в памяти (в продакшене использовать БД)
rooms = {}  # {room_code: {'master': master_id, 'players': [player_ids], 'characters': {}}}
characters = {}  # {char_id: character_data}

# Таблица опыта для D&D 5e
XP_THRESHOLDS = {
    1: 0,
    2: 300,
    3: 900,
    4: 2700,
    5: 6500,
    6: 14000,
    7: 23000,
    8: 34000,
    9: 48000,
    10: 64000,
    11: 85000,
    12: 100000,
    13: 120000,
    14: 140000,
    15: 165000,
    16: 195000,
    17: 225000,
    18: 265000,
    19: 305000,
    20: 355000
}

def calculate_level(xp):
    """Рассчитать уровень по опыту"""
    for level in range(20, 0, -1):
        if xp >= XP_THRESHOLDS[level]:
            return level
    return 1

def calculate_modifier(score):
    """Рассчитать модификатор характеристики"""
    return (score - 10) // 2

def generate_room_code():
    """Сгенерировать код комнаты"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/room/<room_code>')
def room(room_code):
    return render_template('index.html', room_code=room_code)

@app.route('/api/create_room', methods=['POST'])
def create_room():
    """Создать новую комнату"""
    data = request.json
    master_name = data.get('master_name', 'DM')
    room_code = generate_room_code()
    
    rooms[room_code] = {
        'master': master_name,
        'players': [],
        'characters': {},
        'created_by': master_name
    }
    
    return jsonify({
        'success': True,
        'room_code': room_code,
        'invite_link': f'/room/{room_code}'
    })

@app.route('/api/join_room', methods=['POST'])
def join_room_api():
    """Присоединиться к комнате"""
    data = request.json
    room_code = data.get('room_code', '').upper()
    player_name = data.get('player_name', 'Player')
    
    if room_code not in rooms:
        return jsonify({'success': False, 'error': 'Комната не найдена'}), 404
    
    rooms[room_code]['players'].append(player_name)
    
    return jsonify({
        'success': True,
        'room_code': room_code,
        'room_data': rooms[room_code]
    })

@app.route('/api/get_room/<room_code>', methods=['GET'])
def get_room(room_code):
    """Получить информацию о комнате"""
    if room_code.upper() not in rooms:
        return jsonify({'success': False, 'error': 'Комната не найдена'}), 404
    
    return jsonify({
        'success': True,
        'room_data': rooms[room_code.upper()]
    })

@app.route('/api/save_character', methods=['POST'])
def save_character():
    """Сохранить персонажа"""
    data = request.json
    char_id = data.get('char_id')
    room_code = data.get('room_code', '').upper()
    
    if not char_id:
        char_id = f"char_{random.randint(1000, 9999)}"
    
    # Автоматический расчет уровня по опыту
    xp = data.get('xp', 0)
    calculated_level = calculate_level(xp)
    data['calculated_level'] = calculated_level
    
    # Расчет модификаторов
    abilities = data.get('abilities', {})
    modifiers = {}
    for ability, score in abilities.items():
        modifiers[f'{ability}_mod'] = calculate_modifier(score)
    data['modifiers'] = modifiers
    
    characters[char_id] = data
    
    if room_code in rooms:
        rooms[room_code]['characters'][char_id] = data
    
    return jsonify({
        'success': True,
        'char_id': char_id,
        'character': data
    })

@app.route('/api/get_character/<char_id>', methods=['GET'])
def get_character(char_id):
    """Получить персонажа"""
    if char_id not in characters:
        return jsonify({'success': False, 'error': 'Персонаж не найден'}), 404
    
    return jsonify({
        'success': True,
        'character': characters[char_id]
    })

@app.route('/api/add_xp', methods=['POST'])
def add_xp():
    """Добавить опыт персонажу (только для мастера)"""
    data = request.json
    char_id = data.get('char_id')
    xp_amount = data.get('xp_amount', 0)
    
    if char_id not in characters:
        return jsonify({'success': False, 'error': 'Персонаж не найден'}), 404
    
    current_xp = characters[char_id].get('xp', 0)
    new_xp = current_xp + xp_amount
    characters[char_id]['xp'] = new_xp
    characters[char_id]['calculated_level'] = calculate_level(new_xp)
    
    # Уведомить всех в комнате об изменении
    for room_code, room_data in rooms.items():
        if char_id in room_data.get('characters', {}):
            socketio.emit('character_updated', {
                'char_id': char_id,
                'character': characters[char_id]
            }, room=room_code)
    
    return jsonify({
        'success': True,
        'character': characters[char_id]
    })

@socketio.on('connect')
def handle_connect():
    print(f'Клиент подключился: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Клиент отключился: {request.sid}')

@socketio.on('join')
def handle_join(data):
    """Присоединиться к комнате через WebSocket"""
    room_code = data.get('room_code', '').upper()
    user_type = data.get('user_type', 'player')  # 'master' или 'player'
    username = data.get('username', 'Anonymous')
    
    join_room(room_code)
    
    if room_code not in rooms:
        rooms[room_code] = {
            'master': username if user_type == 'master' else 'Unknown',
            'players': [],
            'characters': {}
        }
    
    if user_type == 'master':
        rooms[room_code]['master'] = username
    else:
        if username not in rooms[room_code]['players']:
            rooms[room_code]['players'].append(username)
    
    emit('room_joined', {
        'room_code': room_code,
        'room_data': rooms[room_code],
        'user_type': user_type
    })
    
    # Отправить текущих персонажей
    emit('characters_list', {
        'characters': rooms[room_code].get('characters', {})
    })

@socketio.on('roll_dice')
def handle_roll(data):
    """Бросок куба"""
    dice_type = data.get('dice', 'd20')
    modifier = data.get('modifier', 0)
    room_code = data.get('room_code')
    roller = data.get('roller', 'Anonymous')
    
    # Парсим тип куба (например, d20, d6, 2d8)
    if dice_type.startswith('d'):
        num_dice = 1
        sides = int(dice_type[1:])
    elif 'd' in dice_type:
        parts = dice_type.split('d')
        num_dice = int(parts[0]) if parts[0] else 1
        sides = int(parts[1])
    else:
        sides = 20
        num_dice = 1
    
    rolls = [random.randint(1, sides) for _ in range(num_dice)]
    total = sum(rolls) + modifier
    
    result = {
        'roller': roller,
        'dice': dice_type,
        'rolls': rolls,
        'modifier': modifier,
        'total': total,
        'timestamp': True
    }
    
    if room_code:
        emit('dice_rolled', result, room=room_code)
    else:
        emit('dice_rolled', result)

@socketio.on('ability_check')
def handle_ability_check(data):
    """Проверка характеристики"""
    ability = data.get('ability', 'str')
    modifier = data.get('modifier', 0)
    proficiency = data.get('proficiency', False)
    proficiency_bonus = data.get('proficiency_bonus', 0)
    room_code = data.get('room_code')
    roller = data.get('roller', 'Anonymous')
    skill_name = data.get('skill_name', ability)
    
    roll = random.randint(1, 20)
    total_bonus = modifier
    if proficiency:
        total_bonus += proficiency_bonus
    total = roll + total_bonus
    
    result = {
        'roller': roller,
        'check_type': 'ability',
        'ability': ability,
        'skill_name': skill_name,
        'roll': roll,
        'modifier': modifier,
        'proficiency': proficiency,
        'proficiency_bonus': proficiency_bonus if proficiency else 0,
        'total': total,
        'timestamp': True
    }
    
    if room_code:
        emit('check_made', result, room=room_code)
    else:
        emit('check_made', result)

@socketio.on('update_character')
def handle_update_character(data):
    """Обновление персонажа в реальном времени"""
    char_id = data.get('char_id')
    character_data = data.get('character')
    room_code = data.get('room_code')
    
    if char_id and room_code and room_code.upper() in rooms:
        rooms[room_code.upper()]['characters'][char_id] = character_data
        characters[char_id] = character_data
        
        # Рассылаем обновление всем в комнате
        emit('character_updated', {
            'char_id': char_id,
            'character': character_data
        }, room=room_code.upper())

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
