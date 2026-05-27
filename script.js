// Переключение вкладок
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Расчет модификаторов характеристик
function calculateModifiers() {
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    
    abilities.forEach(ability => {
        const score = parseInt(document.getElementById(`${ability}Score`).value) || 10;
        const modifier = Math.floor((score - 10) / 2);
        const modSign = modifier >= 0 ? '+' : '';
        document.getElementById(`${ability}Mod`).textContent = `${modSign}${modifier}`;
    });
    
    updateAllBonuses();
}

// Получение бонуса мастерства в зависимости от уровня
function getProficiencyBonus(level) {
    if (level >= 17) return 6;
    if (level >= 13) return 5;
    if (level >= 9) return 4;
    if (level >= 5) return 3;
    return 2;
}

// Обновление всех бонусов
function updateAllBonuses() {
    const level = parseInt(document.getElementById('charLevel').value) || 1;
    const proficiencyBonus = getProficiencyBonus(level);
    document.getElementById('proficiencyBonus').value = proficiencyBonus;
    
    // Обновление спасбросков
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    abilities.forEach(ability => {
        const modifier = Math.floor(((parseInt(document.getElementById(`${ability}Score`).value) || 10) - 10) / 2);
        const isProficient = document.getElementById(`${ability}SaveProf`).checked;
        const bonus = modifier + (isProficient ? proficiencyBonus : 0);
        const sign = bonus >= 0 ? '+' : '';
        document.getElementById(`${ability}SaveBonus`).textContent = `${sign}${bonus}`;
    });
    
    // Обновление навыков
    updateSkills();
    
    // Обновление инициативы
    const dexMod = Math.floor(((parseInt(document.getElementById('dexScore').value) || 10) - 10) / 2);
    document.getElementById('initiative').value = dexMod >= 0 ? `+${dexMod}` : dexMod;
    
    // Обновление пассивной внимательности
    const wisMod = Math.floor(((parseInt(document.getElementById('wisScore').value) || 10) - 10) / 2);
    const perceptionProf = document.getElementById('skillPerception').checked;
    const passivePerception = 10 + wisMod + (perceptionProf ? proficiencyBonus : 0);
    document.getElementById('passivePerception').value = passivePerception;
    
    // Обновление заклинательных характеристик
    updateSpellcasting();
}

// Обновление бонусов навыков
function updateSkills() {
    const skills = {
        'skillAcrobatics': 'dex',
        'skillAnimalHandling': 'wis',
        'skillArcana': 'int',
        'skillAthletics': 'str',
        'skillDeception': 'cha',
        'skillHistory': 'int',
        'skillInsight': 'wis',
        'skillIntimidation': 'cha',
        'skillInvestigation': 'int',
        'skillMedicine': 'wis',
        'skillNature': 'int',
        'skillPerception': 'wis',
        'skillPerformance': 'cha',
        'skillPersuasion': 'cha',
        'skillReligion': 'int',
        'skillSleightOfHand': 'dex',
        'skillStealth': 'dex',
        'skillSurvival': 'wis'
    };
    
    const level = parseInt(document.getElementById('charLevel').value) || 1;
    const proficiencyBonus = getProficiencyBonus(level);
    
    for (const [skillId, ability] of Object.entries(skills)) {
        const modifier = Math.floor(((parseInt(document.getElementById(`${ability}Score`).value) || 10) - 10) / 2);
        const isProficient = document.getElementById(skillId).checked;
        const bonus = modifier + (isProficient ? proficiencyBonus : 0);
        const sign = bonus >= 0 ? '+' : '';
        
        const bonusId = skillId.replace('skill', '').charAt(0).toLowerCase() + skillId.replace('skill', '').slice(1) + 'Bonus';
        const bonusElement = document.getElementById(bonusId);
        if (bonusElement) {
            bonusElement.textContent = `${sign}${bonus}`;
        }
    }
}

// Обновление заклинательных характеристик
function updateSpellcasting() {
    const spellAbility = document.getElementById('spellAbility').value;
    const level = parseInt(document.getElementById('charLevel').value) || 1;
    const proficiencyBonus = getProficiencyBonus(level);
    
    if (!spellAbility) {
        document.getElementById('spellSaveDC').value = 8;
        document.getElementById('spellAttackBonus').value = 0;
        return;
    }
    
    const abilityScore = parseInt(document.getElementById(`${spellAbility}Score`).value) || 10;
    const abilityModifier = Math.floor((abilityScore - 10) / 2);
    
    const spellSaveDC = 8 + proficiencyBonus + abilityModifier;
    const spellAttackBonus = proficiencyBonus + abilityModifier;
    
    document.getElementById('spellSaveDC').value = spellSaveDC;
    document.getElementById('spellAttackBonus').value = spellAttackBonus >= 0 ? `+${spellAttackBonus}` : spellAttackBonus;
}

// Добавление оружия
function addWeapon() {
    const container = document.getElementById('weaponsList');
    const newWeapon = document.createElement('div');
    newWeapon.className = 'weapon-entry';
    newWeapon.innerHTML = `
        <input type="text" name="weaponName[]" placeholder="Название оружия">
        <input type="text" name="weaponBonus[]" placeholder="Бонус атаки">
        <input type="text" name="weaponDamage[]" placeholder="Урон">
        <input type="text" name="weaponType[]" placeholder="Тип урона">
        <button type="button" class="remove-btn" onclick="removeWeapon(this)">×</button>
    `;
    container.appendChild(newWeapon);
}

// Удаление оружия
function removeWeapon(btn) {
    btn.parentElement.remove();
}

// Добавление предмета
function addItem() {
    const container = document.getElementById('itemsList');
    const newItem = document.createElement('div');
    newItem.className = 'item-entry';
    newItem.innerHTML = `
        <input type="text" name="itemName[]" placeholder="Название предмета">
        <input type="number" name="itemQuantity[]" placeholder="Кол-во" min="1" value="1">
        <input type="text" name="itemWeight[]" placeholder="Вес (фн)">
        <button type="button" class="remove-btn" onclick="removeItem(this)">×</button>
    `;
    container.appendChild(newItem);
}

// Удаление предмета
function removeItem(btn) {
    btn.parentElement.remove();
}

// Добавление черты
function addFeat() {
    const container = document.getElementById('featsList');
    const newFeat = document.createElement('div');
    newFeat.className = 'feat-entry';
    newFeat.innerHTML = `
        <input type="text" name="featName[]" placeholder="Название черты">
        <textarea name="featDescription[]" placeholder="Описание" rows="2"></textarea>
        <button type="button" class="remove-btn" onclick="removeFeat(this)">×</button>
    `;
    container.appendChild(newFeat);
}

// Удаление черты
function removeFeat(btn) {
    btn.parentElement.remove();
}

// Добавление заклинания
function addSpell() {
    const container = document.getElementById('spellsList');
    const newSpell = document.createElement('div');
    newSpell.className = 'spell-entry';
    newSpell.innerHTML = `
        <input type="text" name="spellName[]" placeholder="Название заклинания">
        <input type="number" name="spellLevel[]" placeholder="Уровень" min="0" max="9">
        <input type="text" name="spellSchool[]" placeholder="Школа">
        <textarea name="spellDescription[]" placeholder="Описание" rows="2"></textarea>
        <button type="button" class="remove-btn" onclick="removeSpell(this)">×</button>
    `;
    container.appendChild(newSpell);
}

// Удаление заклинания
function removeSpell(btn) {
    btn.parentElement.remove();
}

// Сохранение персонажа в localStorage
function saveCharacter() {
    const formData = new FormData(document.getElementById('characterSheet'));
    const characterData = {};
    
    // Собираем все данные формы
    for (let [key, value] of formData.entries()) {
        // Обрабатываем массивы
        if (key.includes('[]')) {
            const arrayKey = key.replace('[]', '');
            if (!characterData[arrayKey]) {
                characterData[arrayKey] = [];
            }
            characterData[arrayKey].push(value);
        } else {
            characterData[key] = value;
        }
    }
    
    // Сохраняем в localStorage
    localStorage.setItem('dicefall_character', JSON.stringify(characterData));
    alert('Персонаж сохранен!');
}

// Загрузка персонажа из localStorage
function loadCharacter() {
    const savedData = localStorage.getItem('dicefall_character');
    if (!savedData) {
        alert('Нет сохраненных персонажей!');
        return;
    }
    
    const characterData = JSON.parse(savedData);
    
    // Заполняем форму данными
    for (const [key, value] of Object.entries(characterData)) {
        if (Array.isArray(value)) {
            // Обрабатываем массивы (оружие, предметы, черты, заклинания)
            const inputs = document.querySelectorAll(`[name="${key}[]"]`);
            value.forEach((val, index) => {
                if (inputs[index]) {
                    inputs[index].value = val;
                } else if (index === value.length - 1 && inputs.length > 0) {
                    // Добавляем новые поля если нужно
                    switch(key) {
                        case 'weaponName':
                            addWeapon();
                            const newWeapons = document.querySelectorAll('[name="weaponName[]"]');
                            newWeapons[newWeapons.length - 1].value = val;
                            break;
                        case 'itemName':
                            addItem();
                            const newItems = document.querySelectorAll('[name="itemName[]"]');
                            newItems[newItems.length - 1].value = val;
                            break;
                        case 'featName':
                            addFeat();
                            const newFeats = document.querySelectorAll('[name="featName[]"]');
                            newFeats[newFeats.length - 1].value = val;
                            break;
                        case 'spellName':
                            addSpell();
                            const newSpells = document.querySelectorAll('[name="spellName[]"]');
                            newSpells[newSpells.length - 1].value = val;
                            break;
                    }
                }
            });
        } else {
            const element = document.getElementById(key);
            if (element) {
                element.value = value;
            }
        }
    }
    
    // Пересчитываем все бонусы
    calculateModifiers();
    alert('Персонаж загружен!');
}

// Экспорт в JSON файл
function exportCharacter() {
    const formData = new FormData(document.getElementById('characterSheet'));
    const characterData = {};
    
    for (let [key, value] of formData.entries()) {
        if (key.includes('[]')) {
            const arrayKey = key.replace('[]', '');
            if (!characterData[arrayKey]) {
                characterData[arrayKey] = [];
            }
            characterData[arrayKey].push(value);
        } else {
            characterData[key] = value;
        }
    }
    
    const dataStr = JSON.stringify(characterData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `character_${characterData.charName || 'unnamed'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Импорт из JSON файла
function importCharacter(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const characterData = JSON.parse(e.target.result);
            
            // Очищаем текущие списки
            document.getElementById('weaponsList').innerHTML = '';
            document.getElementById('itemsList').innerHTML = '';
            document.getElementById('featsList').innerHTML = '';
            document.getElementById('spellsList').innerHTML = '';
            
            // Заполняем форму данными
            for (const [key, value] of Object.entries(characterData)) {
                if (Array.isArray(value)) {
                    value.forEach((val, index) => {
                        if (index === 0) {
                            // Первое значение заполняем в существующее поле
                            const input = document.querySelector(`[name="${key}[]"]`);
                            if (input) input.value = val;
                        } else {
                            // Последующие значения добавляем новые поля
                            switch(key) {
                                case 'weaponName':
                                    addWeapon();
                                    const weapons = document.querySelectorAll('[name="weaponName[]"]');
                                    weapons[weapons.length - 1].value = val;
                                    break;
                                case 'itemName':
                                    addItem();
                                    const items = document.querySelectorAll('[name="itemName[]"]');
                                    items[items.length - 1].value = val;
                                    break;
                                case 'featName':
                                    addFeat();
                                    const feats = document.querySelectorAll('[name="featName[]"]');
                                    feats[feats.length - 1].value = val;
                                    break;
                                case 'spellName':
                                    addSpell();
                                    const spells = document.querySelectorAll('[name="spellName[]"]');
                                    spells[spells.length - 1].value = val;
                                    break;
                            }
                        }
                        
                        // Заполняем связанные поля
                        const otherKeys = Object.keys(characterData).filter(k => k !== key && Array.isArray(characterData[k]));
                        otherKeys.forEach(otherKey => {
                            if (characterData[otherKey][index] !== undefined) {
                                const inputs = document.querySelectorAll(`[name="${otherKey}[]"]`);
                                if (inputs[index]) {
                                    inputs[index].value = characterData[otherKey][index];
                                }
                            }
                        });
                    });
                } else {
                    const element = document.getElementById(key);
                    if (element) {
                        element.value = value;
                    }
                }
            }
            
            // Пересчитываем все бонусы
            calculateModifiers();
            alert('Персонаж успешно импортирован!');
        } catch (error) {
            alert('Ошибка при импорте файла. Убедитесь, что это корректный JSON файл персонажа.');
            console.error(error);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Сбрасываем значение input
}

// Новый персонаж
function newCharacter() {
    if (confirm('Вы уверены? Все несохраненные данные будут потеряны.')) {
        document.getElementById('characterSheet').reset();
        
        // Сбрасываем все динамические списки к одному элементу
        document.getElementById('weaponsList').innerHTML = `
            <div class="weapon-entry">
                <input type="text" name="weaponName[]" placeholder="Название оружия">
                <input type="text" name="weaponBonus[]" placeholder="Бонус атаки">
                <input type="text" name="weaponDamage[]" placeholder="Урон">
                <input type="text" name="weaponType[]" placeholder="Тип урона">
                <button type="button" class="remove-btn" onclick="removeWeapon(this)">×</button>
            </div>
        `;
        
        document.getElementById('itemsList').innerHTML = `
            <div class="item-entry">
                <input type="text" name="itemName[]" placeholder="Название предмета">
                <input type="number" name="itemQuantity[]" placeholder="Кол-во" min="1" value="1">
                <input type="text" name="itemWeight[]" placeholder="Вес (фн)">
                <button type="button" class="remove-btn" onclick="removeItem(this)">×</button>
            </div>
        `;
        
        document.getElementById('featsList').innerHTML = `
            <div class="feat-entry">
                <input type="text" name="featName[]" placeholder="Название черты">
                <textarea name="featDescription[]" placeholder="Описание" rows="2"></textarea>
                <button type="button" class="remove-btn" onclick="removeFeat(this)">×</button>
            </div>
        `;
        
        document.getElementById('spellsList').innerHTML = `
            <div class="spell-entry">
                <input type="text" name="spellName[]" placeholder="Название заклинания">
                <input type="number" name="spellLevel[]" placeholder="Уровень" min="0" max="9">
                <input type="text" name="spellSchool[]" placeholder="Школа">
                <textarea name="spellDescription[]" placeholder="Описание" rows="2"></textarea>
                <button type="button" class="remove-btn" onclick="removeSpell(this)">×</button>
            </div>
        `;
        
        // Сбрасываем модификаторы
        calculateModifiers();
    }
}

// Отслеживание изменения уровня для обновления бонуса мастерства
document.getElementById('charLevel').addEventListener('change', updateAllBonuses);

// Отслеживание изменения характеристики заклинаний
document.getElementById('spellAbility').addEventListener('change', updateSpellcasting);

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    calculateModifiers();
});
