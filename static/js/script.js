// Глобальные переменные
let socket = null;
let currentRoomCode = null;
let userType = null; // 'master' или 'player'
let username = null;
let currentCharId = null;
let charactersInRoom = {};

// Таблица опыта для D&D 5e
const XP_THRESHOLDS = {
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
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    setupTabs();
    calculateModifiers();
    
    // Проверяем, есть ли код комнаты в URL
    const pathParts = window.location.pathname.split('/');
    if (pathParts.includes('room') && pathParts.length > 2) {
        const roomCodeFromUrl = pathParts[pathParts.indexOf('room') + 1];
        if (roomCodeFromUrl) {
            document.getElementById('roomCodeInput').value = roomCodeFromUrl;
        }
    }
    
    // Отслеживаем изменение опыта для авто-расчета уровня
    document.getElementById('charExp').addEventListener('input', updateLevelFromXP);
    updateLevelFromXP();
});

// Настройка вкладок
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Убираем активный класс со всех кнопок и контента
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Добавляем активный класс текущей
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Создание комнаты (Мастер)
async function createRoom() {
    const masterName = document.getElementById('masterName').value.trim() || 'DM';
    
    try {
        const response = await fetch('/api/create_room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ master_name: masterName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentRoomCode = data.room_code;
            userType = 'master';
            username = masterName;
            connectSocket(data.room_code, 'master', masterName);
            showMainInterface();
        }
    } catch (error) {
        alert('Ошибка создания комнаты: ' + error.message);
    }
}

// Присоединение к комнате (Игрок)
async function joinRoom() {
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    const playerName = document.getElementById('playerName').value.trim() || 'Player';
    
    if (!roomCode) {
        alert('Введите код комнаты');
        return;
    }
    
    try {
        const response = await fetch('/api/join_room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_code: roomCode, player_name: playerName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentRoomCode = roomCode;
            userType = 'player';
            username = playerName;
            connectSocket(roomCode, 'player', playerName);
            showMainInterface();
        } else {
            alert('Ошибка: ' + data.error);
        }
    } catch (error) {
        alert('Ошибка подключения: ' + error.message);
    }
}

// Показать основной интерфейс
function showMainInterface() {
    document.getElementById('lobbySection').style.display = 'none';
    document.getElementById('mainInterface').style.display = 'block';
    document.getElementById('roomInfo').style.display = 'block';
    document.getElementById('roomCodeDisplay').textContent = currentRoomCode;
    document.getElementById('userTypeDisplay').textContent = userType === 'master' ? '👑 Мастер' : '🎮 Игрок';
    
    if (userType === 'master') {
        document.getElementById('dmTab').style.display = 'block';
    }
}

// Подключение WebSocket
function connectSocket(roomCode, type, name) {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Подключено к серверу');
        socket.emit('join', {
            room_code: roomCode,
            user_type: type,
            username: name
        });
    });
    
    socket.on('room_joined', (data) => {
        console.log('Присоединился к комнате:', data);
        updatePlayersList(data.room_data.players);
    });
    
    socket.on('characters_list', (data) => {
        console.log('Список персонажей:', data);
        charactersInRoom = data.characters || {};
        updateDMCharactersList();
    });
    
    socket.on('character_updated', (data) => {
        console.log('Персонаж обновлен:', data);
        if (data.char_id === currentCharId) {
            loadCharacterData(data.character);
        }
        charactersInRoom[data.char_id] = data.character;
        updateDMCharactersList();
    });
    
    socket.on('dice_rolled', (data) => {
        addDiceResult(data);
    });
    
    socket.on('check_made', (data) => {
        addCheckResult(data);
    });
}

// Расчет модификаторов
function calculateModifiers() {
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const level = parseInt(document.getElementById('charLevel').value) || 1;
    const proficiencyBonus = Math.floor((level - 1) / 4) + 2;
    
    abilities.forEach(ability => {
        const score = parseInt(document.getElementById(`${ability}Score`).value) || 10;
        const modifier = Math.floor((score - 10) / 2);
        const modSign = modifier >= 0 ? '+' : '';
        document.getElementById(`${ability}Mod`).textContent = `${modSign}${modifier}`;
        
        // Спасброски
        const saveProf = document.getElementById(`${ability}SaveProf`).checked;
        const saveBonus = modifier + (saveProf ? proficiencyBonus : 0);
        const saveSign = saveBonus >= 0 ? '+' : '';
        document.getElementById(`${ability}SaveBonus`).textContent = `${saveSign}${saveBonus}`;
        
        // Навыки
        updateSkillBonus(ability, proficiencyBonus);
    });
    
    // Пассивная внимательность
    const wisMod = Math.floor(((parseInt(document.getElementById('wisScore').value) || 10) - 10) / 2);
    const perceptionProf = document.getElementById('skillPerception').checked;
    const passivePerception = 10 + wisMod + (perceptionProf ? proficiencyBonus : 0);
    document.getElementById('passivePerception').textContent = passivePerception;
    
    // Инициатива
    const dexMod = Math.floor(((parseInt(document.getElementById('dexScore').value) || 10) - 10) / 2);
    document.getElementById('initiative').value = dexMod;
    
    // Заклинания
    updateSpellcasting();
}

// Обновление бонуса навыка
function updateSkillBonus(ability, proficiencyBonus) {
    const skillMap = {
        'str': ['athletics'],
        'dex': ['acrobatics', 'sleightOfHand', 'stealth'],
        'int': ['arcana', 'history', 'investigation', 'nature', 'religion'],
        'wis': ['animalHandling', 'insight', 'medicine', 'perception', 'survival'],
        'cha': ['deception', 'intimidation', 'performance', 'persuasion']
    };
    
    const modValue = Math.floor(((parseInt(document.getElementById(`${ability}Score`).value) || 10) - 10) / 2);
    
    skillMap[ability].forEach(skill => {
        const prof = document.getElementById(`skill${capitalize(skill)}`).checked;
        const bonus = modValue + (prof ? proficiencyBonus : 0);
        const sign = bonus >= 0 ? '+' : '';
        document.getElementById(`${skill}Bonus`).textContent = `${sign}${bonus}`;
    });
}

// Обновление заклинаний
function updateSpellcasting() {
    const spellAbility = document.getElementById('spellcastingAbility').value;
    const level = parseInt(document.getElementById('charLevel').value) || 1;
    const proficiencyBonus = Math.floor((level - 1) / 4) + 2;
    
    if (spellAbility) {
        const score = parseInt(document.getElementById(`${spellAbility}Score`).value) || 10;
        const modifier = Math.floor((score - 10) / 2);
        
        const spellSaveDC = 8 + proficiencyBonus + modifier;
        const spellAttackBonus = proficiencyBonus + modifier;
        
        document.getElementById('spellSaveDC').value = spellSaveDC;
        document.getElementById('spellAttackBonus').value = spellAttackBonus;
    } else {
        document.getElementById('spellSaveDC').value = 8;
        document.getElementById('spellAttackBonus').value = 0;
    }
}

// Обновление уровня по опыту
function updateLevelFromXP() {
    const xp = parseInt(document.getElementById('charExp').value) || 0;
    let level = 1;
    
    for (let l = 20; l >= 1; l--) {
        if (xp >= XP_THRESHOLDS[l]) {
            level = l;
            break;
        }
    }
    
    document.getElementById('charLevel').value = level;
    
    // Показываем опыт до следующего уровня
    if (level < 20) {
        const nextLevelXP = XP_THRESHOLDS[level + 1];
        const remaining = nextLevelXP - xp;
        document.getElementById('xpToNextLevel').textContent = 
            `До ${level + 1} уровня: ${remaining} XP`;
    } else {
        document.getElementById('xpToNextLevel').textContent = 'Максимальный уровень!';
    }
    
    calculateModifiers();
}

// Бросок куба
function rollDice(diceType) {
    const modifier = 0;
    
    if (socket && currentRoomCode) {
        socket.emit('roll_dice', {
            dice: diceType,
            modifier: modifier,
            room_code: currentRoomCode,
            roller: username
        });
    } else {
        // Локальный бросок
        const sides = parseInt(diceType.substring(1));
        const roll = Math.floor(Math.random() * sides) + 1;
        addDiceResult({
            roller: username || 'Вы',
            dice: diceType,
            rolls: [roll],
            modifier: 0,
            total: roll
        });
    }
}

// Бросок пользовательского куба
function rollCustomDice() {
    const input = document.getElementById('customDice').value.trim();
    if (!input) return;
    
    // Парсим выражение типа 2d6+3 или 3d8
    const match = input.match(/(\d*)d(\d+)([+-]\d+)?/i);
    if (!match) {
        alert('Неверный формат. Используйте например: 2d6+3');
        return;
    }
    
    const numDice = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    const modifier = parseInt(match[3]) || 0;
    
    const rolls = [];
    for (let i = 0; i < numDice; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    
    const total = rolls.reduce((a, b) => a + b, 0) + modifier;
    
    if (socket && currentRoomCode) {
        socket.emit('roll_dice', {
            dice: `${numDice}d${sides}`,
            modifier: modifier,
            room_code: currentRoomCode,
            roller: username
        });
    }
    
    addDiceResult({
        roller: username || 'Вы',
        dice: `${numDice}d${sides}`,
        rolls: rolls,
        modifier: modifier,
        total: total
    });
}

// Добавление результата броска
function addDiceResult(data) {
    const resultsDiv = document.getElementById('diceResults');
    const resultDiv = document.createElement('div');
    resultDiv.className = 'dice-result';
    
    const isCritSuccess = data.total >= 20 && data.dice === 'd20';
    const isCritFail = data.total <= 1 && data.dice === 'd20';
    
    if (isCritSuccess) resultDiv.classList.add('crit-success');
    if (isCritFail) resultDiv.classList.add('crit-fail');
    
    const time = new Date().toLocaleTimeString();
    resultDiv.innerHTML = `
        <span class="roller">${data.roller}</span> бросил ${data.dice}: 
        [${data.rolls.join(', ')}]${data.modifier !== 0 ? (data.modifier > 0 ? `+${data.modifier}` : data.modifier) : ''}
        <span class="total">= ${data.total}</span>
        <small style="color: #888; float: right;">${time}</small>
    `;
    
    resultsDiv.insertBefore(resultDiv, resultsDiv.firstChild);
}

// Добавление результата проверки
function addCheckResult(data) {
    const resultsDiv = document.getElementById('diceResults');
    const resultDiv = document.createElement('div');
    resultDiv.className = 'dice-result';
    
    const isCritSuccess = data.roll === 20;
    const isCritFail = data.roll === 1;
    
    if (isCritSuccess) resultDiv.classList.add('crit-success');
    if (isCritFail) resultDiv.classList.add('crit-fail');
    
    const time = new Date().toLocaleTimeString();
    const profText = data.proficiency ? ' (владеет)' : '';
    
    resultDiv.innerHTML = `
        <span class="roller">${data.roller}</span> проверка ${data.skill_name}${profText}: 
        d20[${data.roll}]${data.modifier >= 0 ? '+' : ''}${data.modifier}${data.proficiency_bonus > 0 ? '+' + data.proficiency_bonus : ''}
        <span class="total">= ${data.total}</span>
        <small style="color: #888; float: right;">${time}</small>
    `;
    
    resultsDiv.insertBefore(resultDiv, resultsDiv.firstChild);
}

// Проверка характеристики
function makeAbilityCheck(ability, abilityName) {
    const score = parseInt(document.getElementById(`${ability}Score`).value) || 10;
    const modifier = Math.floor((score - 10) / 2);
    const level = parseInt(document.getElementById('charLevel').value) || 1;
    const proficiencyBonus = Math.floor((level - 1) / 4) + 2;
    
    // Проверяем, есть ли владение спасброском
    const proficient = document.getElementById(`${ability}SaveProf`).checked;
    
    if (socket && currentRoomCode) {
        socket.emit('ability_check', {
            ability: ability,
            modifier: modifier,
            proficiency: proficient,
            proficiency_bonus: proficiencyBonus,
            room_code: currentRoomCode,
            roller: username,
            skill_name: abilityName
        });
    } else {
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + modifier + (proficient ? proficiencyBonus : 0);
        addCheckResult({
            roller: username || 'Вы',
            ability: ability,
            skill_name: abilityName,
            roll: roll,
            modifier: modifier,
            proficiency: proficient,
            proficiency_bonus: proficient ? proficiencyBonus : 0,
            total: total
        });
    }
}

// Проверка навыка
function makeSkillCheck(skill, skillName, ability) {
    const score = parseInt(document.getElementById(`${ability}Score`).value) || 10;
    const modifier = Math.floor((score - 10) / 2);
    const level = parseInt(document.getElementById('charLevel').value) || 1;
    const proficiencyBonus = Math.floor((level - 1) / 4) + 2;
    
    const proficient = document.getElementById(`skill${capitalize(skill)}`).checked;
    
    if (socket && currentRoomCode) {
        socket.emit('ability_check', {
            ability: ability,
            modifier: modifier,
            proficiency: proficient,
            proficiency_bonus: proficiencyBonus,
            room_code: currentRoomCode,
            roller: username,
            skill_name: skillName
        });
    } else {
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + modifier + (proficient ? proficiencyBonus : 0);
        addCheckResult({
            roller: username || 'Вы',
            ability: ability,
            skill_name: skillName,
            roll: roll,
            modifier: modifier,
            proficiency: proficient,
            proficiency_bonus: proficient ? proficiencyBonus : 0,
            total: total
        });
    }
}

// Вспомогательная функция для капитализации
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Добавить оружие
function addWeapon() {
    const weaponsList = document.getElementById('weaponsList');
    const weaponEntry = document.createElement('div');
    weaponEntry.className = 'weapon-entry';
    weaponEntry.innerHTML = `
        <input type="text" name="weaponName[]" placeholder="Название оружия">
        <input type="text" name="weaponBonus[]" placeholder="Бонус атаки">
        <input type="text" name="weaponDamage[]" placeholder="Урон">
        <input type="text" name="weaponType[]" placeholder="Тип урона">
        <button type="button" class="remove-btn" onclick="removeWeapon(this)">×</button>
    `;
    weaponsList.appendChild(weaponEntry);
}

// Удалить оружие
function removeWeapon(btn) {
    btn.parentElement.remove();
}

// Сохранение персонажа
async function saveCharacter() {
    const characterData = getCharacterData();
    
    try {
        const response = await fetch('/api/save_character', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                char_id: currentCharId,
                room_code: currentRoomCode,
                ...characterData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentCharId = data.char_id;
            alert('Персонаж сохранен!');
            
            // Обновляем в комнате через WebSocket
            if (socket && currentRoomCode) {
                socket.emit('update_character', {
                    char_id: currentCharId,
                    character: data.character,
                    room_code: currentRoomCode
                });
            }
        }
    } catch (error) {
        alert('Ошибка сохранения: ' + error.message);
    }
}

// Получение данных персонажа
function getCharacterData() {
    return {
        name: document.getElementById('charName').value,
        class: document.getElementById('charClass').value,
        level: parseInt(document.getElementById('charLevel').value),
        race: document.getElementById('charRace').value,
        alignment: document.getElementById('charAlignment').value,
        xp: parseInt(document.getElementById('charExp').value),
        background: document.getElementById('charBackground').value,
        languages: document.getElementById('charLanguages').value,
        abilities: {
            str: parseInt(document.getElementById('strScore').value),
            dex: parseInt(document.getElementById('dexScore').value),
            con: parseInt(document.getElementById('conScore').value),
            int: parseInt(document.getElementById('intScore').value),
            wis: parseInt(document.getElementById('wisScore').value),
            cha: parseInt(document.getElementById('chaScore').value)
        },
        savingThrows: {
            str: document.getElementById('strSaveProf').checked,
            dex: document.getElementById('dexSaveProf').checked,
            con: document.getElementById('conSaveProf').checked,
            int: document.getElementById('intSaveProf').checked,
            wis: document.getElementById('wisSaveProf').checked,
            cha: document.getElementById('chaSaveProf').checked
        },
        hp: {
            max: parseInt(document.getElementById('hpMax').value),
            current: parseInt(document.getElementById('hpCurrent').value),
            temp: parseInt(document.getElementById('hpTemp').value)
        },
        hitDice: {
            type: document.getElementById('hitDiceType').value,
            total: parseInt(document.getElementById('hitDiceTotal').value),
            used: parseInt(document.getElementById('hitDiceUsed').value)
        },
        armorClass: parseInt(document.getElementById('armorClass').value),
        speed: parseInt(document.getElementById('speed').value),
        skills: {
            acrobatics: document.getElementById('skillAcrobatics').checked,
            animalHandling: document.getElementById('skillAnimalHandling').checked,
            arcana: document.getElementById('skillArcana').checked,
            athletics: document.getElementById('skillAthletics').checked,
            deception: document.getElementById('skillDeception').checked,
            history: document.getElementById('skillHistory').checked,
            insight: document.getElementById('skillInsight').checked,
            intimidation: document.getElementById('skillIntimidation').checked,
            investigation: document.getElementById('skillInvestigation').checked,
            medicine: document.getElementById('skillMedicine').checked,
            nature: document.getElementById('skillNature').checked,
            perception: document.getElementById('skillPerception').checked,
            performance: document.getElementById('skillPerformance').checked,
            persuasion: document.getElementById('skillPersuasion').checked,
            religion: document.getElementById('skillReligion').checked,
            sleightOfHand: document.getElementById('skillSleightOfHand').checked,
            stealth: document.getElementById('skillStealth').checked,
            survival: document.getElementById('skillSurvival').checked
        },
        classFeatures: document.getElementById('classFeatures').value,
        racialFeatures: document.getElementById('racialFeatures').value,
        feats: document.getElementById('feats').value,
        equipment: document.getElementById('equipment').value,
        currency: {
            gold: parseInt(document.getElementById('gold').value),
            silver: parseInt(document.getElementById('silver').value),
            copper: parseInt(document.getElementById('copper').value),
            platinum: parseInt(document.getElementById('platinum').value),
            electrum: parseInt(document.getElementById('electrum').value)
        },
        spellcastingAbility: document.getElementById('spellcastingAbility').value,
        spellSlots: {
            1: { total: parseInt(document.getElementById('spellSlots1').value), used: parseInt(document.getElementById('spellSlots1Used').value) },
            2: { total: parseInt(document.getElementById('spellSlots2').value), used: parseInt(document.getElementById('spellSlots2Used').value) },
            3: { total: parseInt(document.getElementById('spellSlots3').value), used: parseInt(document.getElementById('spellSlots3Used').value) },
            4: { total: parseInt(document.getElementById('spellSlots4').value), used: parseInt(document.getElementById('spellSlots4Used').value) },
            5: { total: parseInt(document.getElementById('spellSlots5').value), used: parseInt(document.getElementById('spellSlots5Used').value) },
            6: { total: parseInt(document.getElementById('spellSlots6').value), used: parseInt(document.getElementById('spellSlots6Used').value) },
            7: { total: parseInt(document.getElementById('spellSlots7').value), used: parseInt(document.getElementById('spellSlots7Used').value) },
            8: { total: parseInt(document.getElementById('spellSlots8').value), used: parseInt(document.getElementById('spellSlots8Used').value) },
            9: { total: parseInt(document.getElementById('spellSlots9').value), used: parseInt(document.getElementById('spellSlots9Used').value) }
        },
        spellsList: document.getElementById('spellsList').value
    };
}

// Загрузка персонажа
async function loadCharacter() {
    if (!currentCharId) {
        alert('Сначала сохраните персонажа, чтобы получить ID');
        return;
    }
    
    try {
        const response = await fetch(`/api/get_character/${currentCharId}`);
        const data = await response.json();
        
        if (data.success) {
            loadCharacterData(data.character);
            alert('Персонаж загружен!');
        }
    } catch (error) {
        alert('Ошибка загрузки: ' + error.message);
    }
}

// Загрузка данных персонажа в форму
function loadCharacterData(data) {
    document.getElementById('charName').value = data.name || '';
    document.getElementById('charClass').value = data.class || '';
    document.getElementById('charLevel').value = data.level || 1;
    document.getElementById('charRace').value = data.race || '';
    document.getElementById('charAlignment').value = data.alignment || '';
    document.getElementById('charExp').value = data.xp || 0;
    document.getElementById('charBackground').value = data.background || '';
    document.getElementById('charLanguages').value = data.languages || '';
    
    if (data.abilities) {
        document.getElementById('strScore').value = data.abilities.str || 10;
        document.getElementById('dexScore').value = data.abilities.dex || 10;
        document.getElementById('conScore').value = data.abilities.con || 10;
        document.getElementById('intScore').value = data.abilities.int || 10;
        document.getElementById('wisScore').value = data.abilities.wis || 10;
        document.getElementById('chaScore').value = data.abilities.cha || 10;
    }
    
    if (data.savingThrows) {
        document.getElementById('strSaveProf').checked = data.savingThrows.str || false;
        document.getElementById('dexSaveProf').checked = data.savingThrows.dex || false;
        document.getElementById('conSaveProf').checked = data.savingThrows.con || false;
        document.getElementById('intSaveProf').checked = data.savingThrows.int || false;
        document.getElementById('wisSaveProf').checked = data.savingThrows.wis || false;
        document.getElementById('chaSaveProf').checked = data.savingThrows.cha || false;
    }
    
    if (data.hp) {
        document.getElementById('hpMax').value = data.hp.max || 10;
        document.getElementById('hpCurrent').value = data.hp.current || 10;
        document.getElementById('hpTemp').value = data.hp.temp || 0;
    }
    
    if (data.skills) {
        document.getElementById('skillAcrobatics').checked = data.skills.acrobatics || false;
        document.getElementById('skillAnimalHandling').checked = data.skills.animalHandling || false;
        document.getElementById('skillArcana').checked = data.skills.arcana || false;
        document.getElementById('skillAthletics').checked = data.skills.athletics || false;
        document.getElementById('skillDeception').checked = data.skills.deception || false;
        document.getElementById('skillHistory').checked = data.skills.history || false;
        document.getElementById('skillInsight').checked = data.skills.insight || false;
        document.getElementById('skillIntimidation').checked = data.skills.intimidation || false;
        document.getElementById('skillInvestigation').checked = data.skills.investigation || false;
        document.getElementById('skillMedicine').checked = data.skills.medicine || false;
        document.getElementById('skillNature').checked = data.skills.nature || false;
        document.getElementById('skillPerception').checked = data.skills.perception || false;
        document.getElementById('skillPerformance').checked = data.skills.performance || false;
        document.getElementById('skillPersuasion').checked = data.skills.persuasion || false;
        document.getElementById('skillReligion').checked = data.skills.religion || false;
        document.getElementById('skillSleightOfHand').checked = data.skills.sleightOfHand || false;
        document.getElementById('skillStealth').checked = data.skills.stealth || false;
        document.getElementById('skillSurvival').checked = data.skills.survival || false;
    }
    
    document.getElementById('classFeatures').value = data.classFeatures || '';
    document.getElementById('racialFeatures').value = data.racialFeatures || '';
    document.getElementById('feats').value = data.feats || '';
    document.getElementById('equipment').value = data.equipment || '';
    
    if (data.currency) {
        document.getElementById('gold').value = data.currency.gold || 0;
        document.getElementById('silver').value = data.currency.silver || 0;
        document.getElementById('copper').value = data.currency.copper || 0;
        document.getElementById('platinum').value = data.currency.platinum || 0;
        document.getElementById('electrum').value = data.currency.electrum || 0;
    }
    
    document.getElementById('spellcastingAbility').value = data.spellcastingAbility || '';
    document.getElementById('spellsList').value = data.spellsList || '';
    
    calculateModifiers();
    updateLevelFromXP();
}

// Экспорт персонажа
function exportCharacter() {
    const characterData = getCharacterData();
    const dataStr = JSON.stringify(characterData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${characterData.name || 'character'}_character.json`;
    link.click();
    
    URL.revokeObjectURL(url);
}

// Импорт персонажа
function importCharacter(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            loadCharacterData(data);
            alert('Персонаж импортирован!');
        } catch (error) {
            alert('Ошибка импорта: неверный формат файла');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// Обновление списка игроков
function updatePlayersList(players) {
    const playersList = document.getElementById('playersList');
    if (players && players.length > 0) {
        playersList.innerHTML = players.map(p => `<div>🎮 ${p}</div>`).join('');
    } else {
        playersList.innerHTML = '<p>Нет игроков</p>';
    }
}

// Обновление списка персонажей для мастера
function updateDMCharactersList() {
    const dmCharsList = document.getElementById('dmCharactersList');
    const dmCharSelect = document.getElementById('dmCharSelect');
    
    const charIds = Object.keys(charactersInRoom);
    
    if (charIds.length > 0) {
        dmCharsList.innerHTML = charIds.map(id => {
            const char = charactersInRoom[id];
            return `<div><strong>${char.name || 'Без имени'}</strong> (Ур. ${char.level || 1}) - ${char.class || 'Класс не указан'}</div>`;
        }).join('');
        
        dmCharSelect.innerHTML = '<option value="">Выберите персонажа</option>' +
            charIds.map(id => {
                const char = charactersInRoom[id];
                return `<option value="${id}">${char.name || 'Без имени'} (Ур. ${char.level || 1})</option>`;
            }).join('');
    } else {
        dmCharsList.innerHTML = '<p>Нет персонажей</p>';
        dmCharSelect.innerHTML = '<option value="">Выберите персонажа</option>';
    }
}

// Добавить опыт (только мастер)
async function addXP() {
    const charId = document.getElementById('dmCharSelect').value;
    const xpAmount = parseInt(document.getElementById('xpAmount').value) || 0;
    
    if (!charId || xpAmount <= 0) {
        alert('Выберите персонажа и введите количество опыта');
        return;
    }
    
    try {
        const response = await fetch('/api/add_xp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ char_id: charId, xp_amount: xpAmount })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Добавлено ${xpAmount} XP!`);
            document.getElementById('xpAmount').value = '';
        }
    } catch (error) {
        alert('Ошибка добавления опыта: ' + error.message);
    }
}
