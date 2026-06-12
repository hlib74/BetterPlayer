const COUNTER_SPRING_STIFFNESS = 200;
const COUNTER_SPRING_DAMPING = 20;
const COUNTER_SPRING_MASS = 1;
const SLIDER_SPRING_STIFFNESS = 300;
const SLIDER_SPRING_DAMPING = 20;
const SLIDER_SPRING_MASS = 1;
document.addEventListener('DOMContentLoaded', async () => {
    class AnimatedCounter {
        constructor(container, options = {}) {
            this.container = container;
            if (!this.container) return;
            this.options = { value: 0, fontSize: 13, ...options };
            this.height = this.options.fontSize;
            this.springParams = { stiffness: COUNTER_SPRING_STIFFNESS, damping: COUNTER_SPRING_DAMPING, mass: COUNTER_SPRING_MASS };
            this.container.classList.add('counter-container');
            this.counterCounter = document.createElement('span');
            this.counterCounter.className = 'counter-counter';
            this.container.appendChild(this.counterCounter);
            this.digits = [];
            this.value = -1;
            this.setValue(this.options.value, true);
        }
        setValue(newValueStr, instant = false) {
            if (!this.container || this.value === newValueStr && !instant) return;
            this.value = newValueStr;
            const valStr = newValueStr.toString();
            let dotIndex = valStr.indexOf('.');
            let integerDigits = 0;
            for (let i = 0; i < (dotIndex >= 0 ? dotIndex : valStr.length); i++) {
                if (!isNaN(parseInt(valStr[i], 10))) integerDigits++;
            }
            let intPlace = Math.pow(10, integerDigits - 1);
            let fracPlace = 0.1;
            const numericVal = parseFloat(valStr.replace(/[^0-9.-]/g, ''));
            const places = [...valStr].map(ch => {
                if (isNaN(parseInt(ch, 10))) return ch;
                let p;
                if (intPlace >= 1) {
                    p = intPlace;
                    intPlace /= 10;
                } else {
                    p = fracPlace;
                    fracPlace /= 10;
                }
                return p;
            });
            if (this.digits.length !== places.length) {
                this.counterCounter.innerHTML = '';
                this.digits = places.map(place => new CounterDigit(this.counterCounter, place, this.height, this.springParams));
            }
            this.digits.forEach(digit => {
                if (typeof digit.place === 'number') {
                    const targetStr = Math.abs(numericVal).toFixed(10);
                    const dotIdx = targetStr.indexOf('.');
                    let intLen = dotIdx === -1 ? targetStr.length : dotIdx;
                    let pValue = 0;
                    if (digit.place >= 1) {
                        let pLog = Math.round(Math.log10(digit.place));
                        let charIdx = intLen - 1 - pLog;
                        if (charIdx >= 0 && charIdx < targetStr.length) {
                            pValue = parseInt(targetStr[charIdx], 10);
                        }
                    } else {
                        let pLog = Math.round(Math.log10(1 / digit.place));
                        let charIdx = intLen + pLog;
                        if (dotIdx !== -1 && charIdx < targetStr.length) {
                            pValue = parseInt(targetStr[charIdx], 10);
                        }
                    }
                    if (isNaN(pValue)) pValue = 0;
                    digit.setTarget(pValue, instant);
                }
            });
        }
    }
    class CounterDigit {
        constructor(parent, place, height, springParams) {
            this.place = place;
            this.height = height;
            this.springParams = springParams;
            this.el = document.createElement('span');
            this.el.className = 'counter-digit';
            if (typeof place === 'string') {
                this.el.textContent = place;
                this.el.style.width = 'fit-content';
                parent.appendChild(this.el);
                return;
            }
            this.numbers = [];
            for (let i = 0; i < 10; i++) {
                const numEl = document.createElement('span');
                numEl.className = 'counter-number';
                numEl.textContent = i;
                this.numbers.push({ el: numEl, val: i });
                this.el.appendChild(numEl);
            }
            parent.appendChild(this.el);
            this.currentValue = 0;
            this.targetValue = 0;
            this.velocity = 0;
            this.animationFrame = null;
        }
        setTarget(target, instant) {
            if (typeof this.place === 'string') return;
            this.targetValue = target;
            if (instant) {
                this.currentValue = target;
                this.velocity = 0;
                this.updateDOM();
            } else {
                if (!this.animationFrame) {
                    this.animationFrame = requestAnimationFrame(() => this.spring());
                }
            }
        }
        spring() {
            const diff = this.targetValue - this.currentValue;
            if (Math.abs(diff) < 0.001 && Math.abs(this.velocity) < 0.001) {
                this.currentValue = this.targetValue;
                this.velocity = 0;
                this.animationFrame = null;
                this.updateDOM();
                return;
            }
            const force = this.springParams.stiffness * diff - this.springParams.damping * this.velocity;
            const dt = 1 / 60;
            this.velocity += force / this.springParams.mass * dt;
            this.currentValue += this.velocity * dt;
            this.updateDOM();
            this.animationFrame = requestAnimationFrame(() => this.spring());
        }
        updateDOM() {
            const latest = this.currentValue;
            let pVal = latest % 10;
            if (pVal < 0) pVal += 10;
            for (let i = 0; i < 10; i++) {
                const number = i;
                let offset = (10 + number - pVal) % 10;
                if (offset < 0) offset += 10;
                let memo = offset * this.height;
                if (offset > 5) {
                    memo -= 10 * this.height;
                }
                this.numbers[i].el.style.transform = `translateY(${memo}px)`;
            }
        }
    }
    class ElasticSlider {
        constructor(containerEl, options) {
            this.container = containerEl;
            this.options = {
                min: 0,
                max: 100,
                value: 50,
                step: 1,
                leftIconSVG: '',
                rightIconSVG: '',
                orientation: 'horizontal',
                onChange: () => { },
                onFormatValue: val => val,
                ...options
            };
            this.MAX_OVERFLOW = 50;
            this.value = this.options.value;
            this.region = 'middle';
            this.overflow = 0;
            this.isDragging = false;
            this.isHovered = false;
            this.animationFrame = null;
            this.springParams = { stiffness: SLIDER_SPRING_STIFFNESS, damping: SLIDER_SPRING_DAMPING, mass: SLIDER_SPRING_MASS };
            this.velocity = 0;
            this.createDOM();
            this.attachEvents();
            this.updateTrackVisuals();
        }
        createDOM() {
            this.wrapper = document.createElement('div');
            this.wrapper.className = 'elastic-slider-wrapper';
            this.wrapper.dataset.orientation = this.options.orientation;
            this.leftIcon = document.createElement('div');
            this.leftIcon.className = 'elastic-icon left-icon';
            this.leftIcon.innerHTML = this.options.leftIconSVG;
            this.rightIcon = document.createElement('div');
            this.rightIcon.className = 'elastic-icon right-icon';
            this.rightIcon.innerHTML = this.options.rightIconSVG;
            this.root = document.createElement('div');
            this.root.className = 'elastic-slider-root';
            this.trackWrapper = document.createElement('div');
            this.trackWrapper.className = 'elastic-slider-track-wrapper';
            this.trackContent = document.createElement('div');
            this.trackContent.className = 'elastic-slider-track';
            this.trackWrapper.appendChild(this.trackContent);
            this.root.appendChild(this.trackWrapper);
            this.wrapper.appendChild(this.leftIcon);
            this.wrapper.appendChild(this.root);
            this.wrapper.appendChild(this.rightIcon);
            this.container.appendChild(this.wrapper);
        }
        decay(value, max) {
            if (max === 0) return 0;
            const entry = value / max;
            const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
            return sigmoid * max;
        }
        getRangePercentage() {
            const totalRange = this.options.max - this.options.min;
            if (totalRange === 0) return 0;
            return ((this.value - this.options.min) / totalRange) * 100;
        }
        handlePointerMove(e) {
            if (!this.isDragging) return;
            const rect = this.root.getBoundingClientRect();
            let rawOverflowPixel = 0;
            let ratio = 0;
            let clientPos = 0;
            if (this.options.orientation === 'vertical') {
                clientPos = e.clientY;
                ratio = (rect.bottom - clientPos) / rect.height;
                if (clientPos > rect.bottom) {
                    this.region = 'left';
                    rawOverflowPixel = clientPos - rect.bottom;
                } else if (clientPos < rect.top) {
                    this.region = 'right';
                    rawOverflowPixel = rect.top - clientPos;
                } else {
                    this.region = 'middle';
                    rawOverflowPixel = 0;
                }
            } else {
                clientPos = e.clientX;
                ratio = (clientPos - rect.left) / rect.width;
                if (clientPos < rect.left) {
                    this.region = 'left';
                    rawOverflowPixel = rect.left - clientPos;
                } else if (clientPos > rect.right) {
                    this.region = 'right';
                    rawOverflowPixel = clientPos - rect.right;
                } else {
                    this.region = 'middle';
                    rawOverflowPixel = 0;
                }
            }
            let newValue = this.options.min + ratio * (this.options.max - this.options.min);
            if (typeof this.options.step === 'function') {
                newValue = this.options.step(newValue);
            } else if (this.options.step) {
                const inv = 1.0 / this.options.step;
                newValue = Math.round(newValue * inv) / inv;
            }
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
            this.overflow = this.decay(rawOverflowPixel, this.MAX_OVERFLOW);
            const clampedValue = Math.min(Math.max(newValue, this.options.min), this.options.max);
            if (clampedValue !== this.value) {
                this.value = clampedValue;
                this.options.onChange(this.value);
            }
            this.updateTrackVisuals(clientPos, rect);
            this.updateIconsVisuals();
        }
        updateTrackVisuals(clientPos = 0, rect = null) {
            if (this.options.orientation === 'vertical') {
                this.trackContent.style.height = `${this.getRangePercentage()}%`;
                this.trackContent.style.width = '100%';
            } else {
                this.trackContent.style.width = `${this.getRangePercentage()}%`;
                this.trackContent.style.height = '100%';
            }
            if (!rect) rect = this.root.getBoundingClientRect();
            const isScaleUpContext = this.isHovered || this.isDragging;
            const currentScaleFactor = isScaleUpContext ? 1.1 : 1.0;
            if (this.overflow > 0) {
                if (this.options.orientation === 'vertical') {
                    if (rect.height > 0) {
                        const stretchFactor = 1 + (this.overflow / rect.height);
                        const squeezeFactor = 1 - (0.2 * (this.overflow / this.MAX_OVERFLOW));
                        const origin = clientPos < (rect.top + rect.height / 2) ? 'bottom' : 'top';
                        this.trackWrapper.style.transformOrigin = origin;
                        this.trackWrapper.style.transform = `scaleY(${stretchFactor}) scaleX(${squeezeFactor})`;
                        if (this.region === 'left') {
                            this.leftIcon.style.transform = `translateY(${this.overflow / currentScaleFactor}px)`;
                            this.rightIcon.style.transform = 'translateY(0px)';
                        } else if (this.region === 'right') {
                            this.rightIcon.style.transform = `translateY(${-(this.overflow / currentScaleFactor)}px)`;
                            this.leftIcon.style.transform = 'translateY(0px)';
                        }
                    }
                } else {
                    if (rect.width > 0) {
                        const stretchFactor = 1 + (this.overflow / rect.width);
                        const squeezeFactor = 1 - (0.2 * (this.overflow / this.MAX_OVERFLOW));
                        const origin = clientPos < (rect.left + rect.width / 2) ? 'right' : 'left';
                        this.trackWrapper.style.transformOrigin = origin;
                        this.trackWrapper.style.transform = `scaleX(${stretchFactor}) scaleY(${squeezeFactor})`;
                        if (this.region === 'left') {
                            this.leftIcon.style.transform = `translateX(${-(this.overflow / currentScaleFactor)}px)`;
                            this.rightIcon.style.transform = 'translateX(0px)';
                        } else if (this.region === 'right') {
                            this.rightIcon.style.transform = `translateX(${this.overflow / currentScaleFactor}px)`;
                            this.leftIcon.style.transform = 'translateX(0px)';
                        }
                    }
                }
            } else {
                this.trackWrapper.style.transform = `scaleX(1) scaleY(1)`;
                this.leftIcon.style.transform = 'translate(0px, 0px)';
                this.rightIcon.style.transform = 'translate(0px, 0px)';
            }
        }
        updateIconsVisuals() {
            if (this.region === 'left' && this.overflow > 5) {
                this.leftIcon.classList.add('bump');
            } else {
                this.leftIcon.classList.remove('bump');
            }
            if (this.region === 'right' && this.overflow > 5) {
                this.rightIcon.classList.add('bump');
            } else {
                this.rightIcon.classList.remove('bump');
            }
        }
        springBack() {
            if (this.overflow <= 0.1 && Math.abs(this.velocity) <= 0.1) {
                this.overflow = 0;
                this.velocity = 0;
                this.region = 'middle';
                this.updateTrackVisuals();
                this.updateIconsVisuals();
                return;
            }
            const dt = 1 / 60;
            const force = -this.springParams.stiffness * this.overflow - this.springParams.damping * this.velocity;
            this.velocity += force / this.springParams.mass * dt;
            this.overflow += this.velocity * dt;
            if (this.overflow < 0) this.overflow = 0;
            this.updateTrackVisuals();
            this.animationFrame = requestAnimationFrame(() => this.springBack());
        }
        attachEvents() {
            this.root.addEventListener('pointerdown', (e) => {
                this.root.setPointerCapture(e.pointerId);
                this.isDragging = true;
                this.wrapper.classList.add('active');
                if (this.animationFrame) {
                    cancelAnimationFrame(this.animationFrame);
                    this.animationFrame = null;
                }
                this.velocity = 0;
                this.handlePointerMove(e);
            });
            this.root.addEventListener('pointermove', (e) => this.handlePointerMove(e));
            this.root.addEventListener('pointerup', (e) => {
                this.isDragging = false;
                this.wrapper.classList.remove('active');
                this.root.releasePointerCapture(e.pointerId);
                if (this.overflow > 0) {
                    this.animationFrame = requestAnimationFrame(() => this.springBack());
                } else {
                    this.region = 'middle';
                    this.updateIconsVisuals();
                }
            });
            this.wrapper.addEventListener('mouseenter', () => {
                this.isHovered = true;
                this.wrapper.classList.add('hovered');
            });
            this.wrapper.addEventListener('mouseleave', () => {
                this.isHovered = false;
                this.wrapper.classList.remove('hovered');
            });
        }
        setValue(val) {
            const clamped = Math.min(Math.max(val, this.options.min), this.options.max);
            this.value = clamped;
            this.updateTrackVisuals();
            this.options.onFormatValue(clamped);
        }
    }
    const tabTabs = document.getElementById('tabTabs');
    const tabSound = document.getElementById('tabSound');
    const tabSettings = document.getElementById('tabSettings');
    const tabsView = document.getElementById('tabsView');
    const soundView = document.getElementById('soundView');
    const settingsView = document.getElementById('settingsView');
    function switchView(activeTabId, activeViewId) {
        [tabTabs, tabSound, tabSettings].forEach(tab => { if (tab) tab.classList.remove('is-active'); });
        [tabsView, soundView, settingsView].forEach(view => { if (view) view.classList.remove('active'); });
        const activeTab = document.getElementById(activeTabId);
        const activeView = document.getElementById(activeViewId);
        if (activeTab) activeTab.classList.add('is-active');
        if (activeView) activeView.classList.add('active');
        if (activeViewId === 'tabsView' && window.tabList) {
            window.tabList.scrollTop = 0;
            if (typeof selectedIndex !== 'undefined') selectedIndex = 0;
            if (typeof tabs !== 'undefined' && tabs.length > 0) updateSelection(false);
        }
    }
    if (tabTabs) tabTabs.addEventListener('click', () => switchView('tabTabs', 'tabsView'));
    if (tabSound) tabSound.addEventListener('click', () => switchView('tabSound', 'soundView'));
    if (tabSettings) tabSettings.addEventListener('click', () => {
        switchView('tabSettings', 'settingsView');
    });
    tabSound.addEventListener('click', () => {
        targetTabId = null;
        updateCustomSelectUI();
        fetchMediaStateForTarget();
        fetchEqStateForTarget();
        updateTargetTitleUI();
        updateCaptureWarning();
    });
    const volumeValue = document.getElementById('volumeValue');
    const speedValue = document.getElementById('speedValue');
    const langSelect = document.getElementById('langSelect');
    const themeSelect = document.getElementById('themeSelect');
    const _browser = chrome;
    const translations = {
        en: {
            tabs: 'Tabs',
            tabControls: 'Tab Controls',
            settings: 'Settings',
            volume: 'Volume',
            equalizer: 'Equalizer',
            playbackSpeed: 'Playback Speed',
            targetTab: 'Target Tab',
            currentTab: 'Current Tab',
            language: 'Language',
            controlCurrentTab: 'Controlling: Current Tab',
            controllingTab: 'Controlling: ',
            currentTabSuffix: '(Current Tab)',
            theme: 'Theme',
            themeSystem: 'System default',
            themeDark: 'Dark',
            themeLight: 'Light',
            themeBlueEclipse: 'Blue Eclipse',
            themeGreenJuice: 'Green Juice',
            themeChiliSpice: 'Chili Spice',
            themeBloomingRomance: 'Blooming Romance',
            themeCaliforniaBeaches: 'California Beaches',
            newTab: 'New Tab',
            eqFlat: 'Flat',
            eqRock: 'Rock',
            eqPop: 'Pop',
            eqBassBoost: 'Bass Boost',
            eqTrebleBoost: 'Treble Boost',
            eqAcoustic: 'Acoustic',
            eqClassical: 'Classical',
            eqElectronic: 'Electronic',
            eqHipHop: 'Hip-Hop',
            eqVocalBoost: 'Vocal Boost',
            eqCustom: 'Custom',
            pageFilters: 'Page Filters',
            brightness: 'Brightness',
            contrast: 'Contrast',
            saturation: 'Saturation',
            sepia: 'Sepia',
            grayscale: 'Grayscale',
            filterReset: 'Reset',
            eqReset: 'Reset',
            monoAudio: 'Mono Audio',
            invertColors: 'Invert Colors',
            blueLight: 'Blue Light Filter',
            focusMask: 'Focus / Privacy Mask',
            sortDomain: 'Domain',
            sortDefault: 'Default',
            sortAlpha: 'A-Z',
            searchTabs: 'Search tabs...',
            spatialAudio: 'Spatial Audio (3D Room)',
            autoSuspend: 'Auto-Suspend Inactive Tabs',
            suspendOff: 'Off',
            suspend5m: '5 Minutes',
            suspend15m: '15 Minutes',
            suspend30m: '30 Minutes',
            suspend1h: '1 Hour',
            suspendCustom: 'Custom...',
            suspendSave: 'Save',
            suspendDelete: 'Delete',
            suspendDeleteConfirm: 'Are you sure you want to delete the suspend preset "{name}"?',
            suspendEnterMinutes: 'Enter the number of minutes for auto-suspend:',
            suspendEnterName: 'Enter a name for this custom suspend preset:',
            sessionManagement: 'Session Management',
            exportSession: 'Export Session',
            importSession: 'Import Session',
            eqSave: 'Save',
            eqDelete: 'Delete',
            eqDeleteConfirm: 'Are you sure you want to delete the preset "{name}"?',
            eqEnterProfileName: 'Enter a name for this custom EQ profile:',
            captureWarning: 'Audio capture is not supported on browser/internal pages. Please use an HTTP/HTTPS webpage.'
        },
        uk: {
            tabs: 'Вкладки',
            tabControls: 'Керування вкладкою',
            settings: 'Налаштування',
            volume: 'Гучність',
            equalizer: 'Еквалайзер',
            playbackSpeed: 'Швидкість відтворення',
            targetTab: 'Цільова вкладка',
            currentTab: 'Поточна вкладка',
            language: 'Мова',
            controlCurrentTab: 'Керування: Поточна вкладка',
            controllingTab: 'Керування: ',
            currentTabSuffix: '(Поточна вкладка)',
            theme: 'Тема',
            themeSystem: 'Системна',
            themeDark: 'Темна',
            themeLight: 'Світла',
            themeBlueEclipse: 'Синє затемнення',
            themeGreenJuice: 'Зелений сік',
            themeChiliSpice: 'Гострий чилі',
            themeBloomingRomance: 'Квітучий романс',
            themeCaliforniaBeaches: 'Каліфорнійські пляжі',
            newTab: 'Нова вкладка',
            eqFlat: 'Рівний',
            eqRock: 'Рок',
            eqPop: 'Поп',
            eqBassBoost: 'Підсилення басів',
            eqTrebleBoost: 'Підсилення високих',
            eqAcoustic: 'Акустичний',
            eqClassical: 'Класичний',
            eqElectronic: 'Електронний',
            eqHipHop: 'Хіп-хоп',
            eqVocalBoost: 'Підсилення вокалу',
            eqCustom: 'Користувацький',
            pageFilters: 'Фільтри сторінки',
            brightness: 'Яскравість',
            contrast: 'Контраст',
            saturation: 'Насиченість',
            sepia: 'Сепія',
            grayscale: 'Відтінки сірого',
            filterReset: 'Скинути',
            eqReset: 'Скинути',
            monoAudio: 'Моно звук',
            invertColors: 'Інвертувати кольори',
            blueLight: 'Фільтр синього світла',
            focusMask: 'Фокус / Маска конфіденційності',
            sortDomain: 'Домен',
            sortDefault: 'Стандартно',
            sortAlpha: 'А-Я',
            searchTabs: 'Пошук вкладок...',
            spatialAudio: 'Просторове аудіо (3D Кімната)',
            autoSuspend: 'Авто-призупинення неактивних вкладок',
            suspendOff: 'Вимкнено',
            suspend5m: '5 хвилин',
            suspend15m: '15 хвилин',
            suspend30m: '30 хвилин',
            suspend1h: '1 година',
            suspendCustom: 'Власне...',
            suspendSave: 'Зберегти',
            suspendDelete: 'Видалити',
            suspendDeleteConfirm: 'Ви впевнені, що хочете видалити пресет "{name}"?',
            suspendEnterMinutes: 'Введіть кількість хвилин для авто-призупинення:',
            suspendEnterName: 'Введіть назву для цього пресету авто-призупинення:',
            sessionManagement: 'Управління сесіями',
            exportSession: 'Експорт сесії',
            importSession: 'Імпорт сесії',
            eqSave: 'Зберегти',
            eqDelete: 'Видалити',
            eqDeleteConfirm: 'Ви впевнені, що хочете видалити пресет "{name}"?',
            eqEnterProfileName: 'Введіть назву для цього профілю еквалайзера:',
            captureWarning: 'Захоплення аудіо не підтримується на службових або внутрішніх сторінках браузера. Будь ласка, використовуйте HTTP/HTTPS веб-сторінку.'
        },
        es: {
            tabs: 'Pestañas',
            tabControls: 'Controles de Pestaña',
            settings: 'Configuración',
            volume: 'Volumen',
            equalizer: 'Ecualizador',
            playbackSpeed: 'Velocidad de Reproducción',
            targetTab: 'Pestaña de Destino',
            currentTab: 'Pestaña Actual',
            language: 'Idioma',
            controlCurrentTab: 'Controlando: Pestaña Actual',
            controllingTab: 'Controlando: ',
            currentTabSuffix: '(Pestaña Actual)',
            theme: 'Tema',
            themeSystem: 'Predeterminado del sistema',
            themeDark: 'Oscuro',
            themeLight: 'Claro',
            themeBlueEclipse: 'Eclipse azul',
            themeGreenJuice: 'Jugo verde',
            themeChiliSpice: 'Chile picante',
            themeBloomingRomance: 'Romance floreciente',
            themeCaliforniaBeaches: 'Playas de California',
            newTab: 'Nueva Pestaña',
            eqFlat: 'Plano',
            eqRock: 'Rock',
            eqPop: 'Pop',
            eqBassBoost: 'Refuerzo de Graves',
            eqTrebleBoost: 'Refuerzo de Agudos',
            eqAcoustic: 'Acústico',
            eqClassical: 'Clásico',
            eqElectronic: 'Electrónico',
            eqHipHop: 'Hip-Hop',
            eqVocalBoost: 'Refuerzo de Voz',
            eqCustom: 'Personalizado',
            pageFilters: 'Filtros de Página',
            brightness: 'Brillo',
            contrast: 'Contraste',
            saturation: 'Saturación',
            sepia: 'Sepia',
            grayscale: 'Escala de Grises',
            filterReset: 'Restablecer',
            eqReset: 'Restablecer',
            monoAudio: 'Audio Mono',
            invertColors: 'Invertir Colores',
            blueLight: 'Filtro de Luz Azul',
            focusMask: 'Máscara de Enfoque / Privacidad',
            sortDomain: 'Dominio',
            sortDefault: 'Predeterminado',
            sortAlpha: 'A-Z',
            searchTabs: 'Buscar pestañas...',
            spatialAudio: 'Audio Espacial (Sala 3D)',
            autoSuspend: 'Auto-suspender pestañas inactivas',
            suspendOff: 'Desactivado',
            suspend5m: '5 Minutos',
            suspend15m: '15 Minutos',
            suspend30m: '30 Minutos',
            suspend1h: '1 Hora',
            suspendCustom: 'Personalizado...',
            suspendSave: 'Guardar',
            suspendDelete: 'Eliminar',
            suspendDeleteConfirm: '¿Está seguro de que desea eliminar el ajuste "{name}"?',
            suspendEnterMinutes: 'Ingrese el número de minutos para la suspensión automática:',
            suspendEnterName: 'Ingrese un nombre para este ajuste de suspensión personalizado:',
            sessionManagement: 'Gestión de Sesiones',
            exportSession: 'Exportar Sesión',
            importSession: 'Importar Sesión',
            eqSave: 'Guardar',
            eqDelete: 'Eliminar',
            eqDeleteConfirm: '¿Está seguro de que desea eliminar el ajuste preestablecido "{name}"?',
            eqEnterProfileName: 'Ingrese un nombre para este perfil de ecualizador personalizado:',
            captureWarning: 'La captura de audio no es compatible con páginas internas del navegador. Utilice una página web HTTP/HTTPS.'
        },
        fr: {
            tabs: 'Onglets',
            tabControls: 'Contrôles d\'Onglet',
            settings: 'Paramètres',
            volume: 'Volume',
            equalizer: 'Égaliseur',
            playbackSpeed: 'Vitesse de Lecture',
            targetTab: 'Onglet Cible',
            currentTab: 'Onglet Actuel',
            language: 'Langue',
            controlCurrentTab: 'Contrôle : Onglet Actuel',
            controllingTab: 'Contrôle : ',
            currentTabSuffix: '(Onglet Actuel)',
            theme: 'Thème',
            themeSystem: 'Par défaut du système',
            themeDark: 'Sombre',
            themeLight: 'Clair',
            themeBlueEclipse: 'Éclipse bleue',
            themeGreenJuice: 'Jus vert',
            themeChiliSpice: 'Piment épicé',
            themeBloomingRomance: 'Romance fleurie',
            themeCaliforniaBeaches: 'Plages de Californie',
            newTab: 'Nouvel Onglet',
            eqFlat: 'Plat',
            eqRock: 'Rock',
            eqPop: 'Pop',
            eqBassBoost: 'Amplification des Basses',
            eqTrebleBoost: 'Amplification des Aigus',
            eqAcoustic: 'Acoustique',
            eqClassical: 'Classique',
            eqElectronic: 'Électronique',
            eqHipHop: 'Hip-Hop',
            eqVocalBoost: 'Amplification des Voix',
            eqCustom: 'Personnalisé',
            pageFilters: 'Filtres de Page',
            brightness: 'Luminosité',
            contrast: 'Contraste',
            saturation: 'Saturation',
            sepia: 'Sépia',
            grayscale: 'Niveaux de Gris',
            filterReset: 'Réinitialiser',
            eqReset: 'Réinitialiser',
            monoAudio: 'Audio Mono',
            invertColors: 'Inverser les Couleurs',
            blueLight: 'Filtro de Luz Azul',
            focusMask: 'Masque de Concentration / Confidentialité',
            sortDomain: 'Domaine',
            sortDefault: 'Par Défaut',
            sortAlpha: 'A-Z',
            searchTabs: 'Rechercher des onglets...',
            spatialAudio: 'Audio Spatial (Salle 3D)',
            autoSuspend: 'Mise en veille automatique des onglets',
            suspendOff: 'Désactivé',
            suspend5m: '5 Minutes',
            suspend15m: '15 Minutes',
            suspend30m: '30 Minutes',
            suspend1h: '1 Heure',
            suspendCustom: 'Personnalisé...',
            suspendSave: 'Enregistrer',
            suspendDelete: 'Supprimer',
            suspendDeleteConfirm: 'Êtes-vous sûr de vouloir supprimer le préréglage "{name}" ?',
            suspendEnterMinutes: 'Entrez le nombre de minutes pour la mise en veille automatique :',
            suspendEnterName: 'Entrez un nom pour ce préréglage de mise en veille personnalisé :',
            sessionManagement: 'Gestion de Session',
            exportSession: 'Exporter la Session',
            importSession: 'Importer la Session',
            eqSave: 'Enregistrer',
            eqDelete: 'Supprimer',
            eqDeleteConfirm: 'Êtes-vous sûr de vouloir supprimer le préréglage "{name}" ?',
            eqEnterProfileName: 'Entrez un nom pour ce profil d\'égaliseur personnalisé :',
            captureWarning: 'La capture audio n\'est pas prise en charge sur les pages internes du navigateur. Veuillez utiliser une page web HTTP/HTTPS.'
        },
        de: {
            tabs: 'Tabs',
            tabControls: 'Tab-Steuerung',
            settings: 'Einstellungen',
            volume: 'Lautstärke',
            equalizer: 'Equalizer',
            playbackSpeed: 'Wiedergabegeschwindigkeit',
            targetTab: 'Ziel-Tab',
            currentTab: 'Aktueller Tab',
            language: 'Sprache',
            controlCurrentTab: 'Steuerung: Aktueller Tab',
            controllingTab: 'Steuerung: ',
            currentTabSuffix: '(Aktueller Tab)',
            theme: 'Design',
            themeSystem: 'Systemstandard',
            themeDark: 'Dunkel',
            themeLight: 'Hell',
            themeBlueEclipse: 'Blaue Finsternis',
            themeGreenJuice: 'Grüner Saft',
            themeChiliSpice: 'Chili-Gewürz',
            themeBloomingRomance: 'Blühende Romanze',
            themeCaliforniaBeaches: 'Strände von Kalifornien',
            newTab: 'Neuer Tab',
            eqFlat: 'Flach',
            eqRock: 'Rock',
            eqPop: 'Pop',
            eqBassBoost: 'Bassverstärkung',
            eqTrebleBoost: 'Höhenverstärkung',
            eqAcoustic: 'Akustisch',
            eqClassical: 'Klassisch',
            eqElectronic: 'Elektronisch',
            eqHipHop: 'Hip-Hop',
            eqVocalBoost: 'Stimmenverstärkung',
            eqCustom: 'Benutzerdefiniert',
            pageFilters: 'Seitenfilter',
            brightness: 'Helligkeit',
            contrast: 'Kontrast',
            saturation: 'Sättigung',
            sepia: 'Sepia',
            grayscale: 'Graustufen',
            filterReset: 'Zurücksetzen',
            eqReset: 'Zurücksetzen',
            monoAudio: 'Mono-Audio',
            invertColors: 'Farben umkehren',
            blueLight: 'Blaulichtfilter',
            focusMask: 'Fokus- / Sichtschutzmaske',
            sortDomain: 'Domain',
            sortDefault: 'Standard',
            sortAlpha: 'A-Z',
            searchTabs: 'Tabs suchen...',
            spatialAudio: 'Räumliches Audio (3D-Raum)',
            autoSuspend: 'Inaktive Tabs automatisch aussetzen',
            suspendOff: 'Aus',
            suspend5m: '5 Minuten',
            suspend15m: '15 Minuten',
            suspend30m: '30 Minuten',
            suspend1h: '1 Stunde',
            suspendCustom: 'Benutzerdefiniert...',
            suspendSave: 'Speichern',
            suspendDelete: 'Löschen',
            suspendDeleteConfirm: 'Sind Sie sicher, dass Sie die Voreinstellung "{name}" löschen möchten?',
            suspendEnterMinutes: 'Geben Sie die Anzahl der Minuten für die automatische Aussetzung ein:',
            suspendEnterName: 'Geben Sie einen Namen für diese benutzerdefinierte Aussetzungsvoreinstellung ein:',
            sessionManagement: 'Sitzungsverwaltung',
            exportSession: 'Sitzung exportieren',
            importSession: 'Sitzung importieren',
            eqSave: 'Speichern',
            eqDelete: 'Löschen',
            eqDeleteConfirm: 'Sind Sie sicher, dass Sie die Voreinstellung "{name}" löschen möchten?',
            eqEnterProfileName: 'Geben Sie einen Namen für dieses benutzerdefinierte Equalizer-Profil ein:',
            captureWarning: 'Die Audioaufnahme wird auf internen Browserseiten nicht unterstützt. Bitte verwenden Sie eine HTTP/HTTPS-Webseite.'
        },
        pt: {
            tabs: 'Abas',
            tabControls: 'Controles de Aba',
            settings: 'Configurações',
            volume: 'Volume',
            equalizer: 'Equalizador',
            playbackSpeed: 'Velocidade de Reprodução',
            targetTab: 'Aba Destino',
            currentTab: 'Aba Atual',
            language: 'Idioma',
            controlCurrentTab: 'Controlando: Aba Atual',
            controllingTab: 'Controlando: ',
            currentTabSuffix: '(Aba Atual)',
            theme: 'Tema',
            themeSystem: 'Padrão do sistema',
            themeDark: 'Escuro',
            themeLight: 'Claro',
            themeBlueEclipse: 'Eclipse azul',
            themeGreenJuice: 'Suco verde',
            themeChiliSpice: 'Pimenta picante',
            themeBloomingRomance: 'Romance florescente',
            themeCaliforniaBeaches: 'Praias da Califórnia',
            newTab: 'Nova Aba',
            eqFlat: 'Plano',
            eqRock: 'Rock',
            eqPop: 'Pop',
            eqBassBoost: 'Reforço de Graves',
            eqTrebleBoost: 'Reforço de Agudos',
            eqAcoustic: 'Acústico',
            eqClassical: 'Clássico',
            eqElectronic: 'Eletrônico',
            eqHipHop: 'Hip-Hop',
            eqVocalBoost: 'Reforço de Voz',
            eqCustom: 'Personalizado',
            pageFilters: 'Filtros de Página',
            brightness: 'Brilho',
            contrast: 'Contraste',
            saturation: 'Saturação',
            sepia: 'Sépia',
            grayscale: 'Escala de Cinza',
            filterReset: 'Redefinir',
            eqReset: 'Redefinir',
            monoAudio: 'Áudio Mono',
            invertColors: 'Inverter Cores',
            blueLight: 'Filtro de Luz Azul',
            focusMask: 'Máscara de Foco / Privacidade',
            sortDomain: 'Domínio',
            sortDefault: 'Padrão',
            sortAlpha: 'A-Z',
            searchTabs: 'Pesquisar abas...',
            spatialAudio: 'Áudio Espacial (Sala 3D)',
            autoSuspend: 'Auto-suspender abas inactivas',
            suspendOff: 'Desativado',
            suspend5m: '5 Minutos',
            suspend15m: '15 Minutos',
            suspend30m: '30 Minutos',
            suspend1h: '1 Hora',
            suspendCustom: 'Personalizado...',
            suspendSave: 'Salvar',
            suspendDelete: 'Excluir',
            suspendDeleteConfirm: 'Tem certeza de que deseja excluir a predefinição "{name}"?',
            suspendEnterMinutes: 'Digite o número de minutos para a suspensão automática:',
            suspendEnterName: 'Digite um nome para esta predefinição de suspensão personalizada:',
            sessionManagement: 'Gestão de Sessão',
            exportSession: 'Exportar Sessão',
            importSession: 'Importar Sessão',
            eqSave: 'Salvar',
            eqDelete: 'Excluir',
            eqDeleteConfirm: 'Tem certeza de que deseja excluir a predefinição "{name}"?',
            eqEnterProfileName: 'Digite um nome para este perfil de equalizador personalizado:',
            captureWarning: 'A captura de áudio não é suportada em páginas internas do navegador. Use uma página HTTP/HTTPS.'
        },
        it: {
            tabs: 'Schede',
            tabControls: 'Controlli Scheda',
            settings: 'Impostazioni',
            volume: 'Volume',
            equalizer: 'Equalizzatore',
            playbackSpeed: 'Velocità di Riproduzione',
            targetTab: 'Scheda di Destinazione',
            currentTab: 'Scheda Corrente',
            language: 'Lingua',
            controlCurrentTab: 'Controllo: Scheda Corrente',
            controllingTab: 'Controllo: ',
            currentTabSuffix: '(Scheda Corrente)',
            theme: 'Tema',
            themeSystem: 'Predefinito di sistema',
            themeDark: 'Scuro',
            themeLight: 'Chiaro',
            themeBlueEclipse: 'Eclissi blu',
            themeGreenJuice: 'Succo verde',
            themeChiliSpice: 'Peperoncino piccante',
            themeBloomingRomance: 'Romanzo in fiore',
            themeCaliforniaBeaches: 'Spiagge della California',
            newTab: 'Nuova Scheda',
            eqFlat: 'Piatto',
            eqRock: 'Rock',
            eqPop: 'Pop',
            eqBassBoost: 'Rinforzo Bassi',
            eqTrebleBoost: 'Rinforzo Alti',
            eqAcoustic: 'Acustico',
            eqClassical: 'Classico',
            eqElectronic: 'Elettronico',
            eqHipHop: 'Hip-Hop',
            eqVocalBoost: 'Rinforzo Voce',
            eqCustom: 'Personalizzato',
            pageFilters: 'Filtri Pagina',
            brightness: 'Luminosità',
            contrast: 'Contrasto',
            saturation: 'Saturazione',
            sepia: 'Seppia',
            grayscale: 'Scala di Grigi',
            filterReset: 'Ripristina',
            eqReset: 'Ripristina',
            monoAudio: 'Audio Mono',
            invertColors: 'Inverti Colori',
            blueLight: 'Filtro Luce Blu',
            focusMask: 'Maschera di Messa a Fuoco / Privacy',
            sortDomain: 'Dominio',
            sortDefault: 'Predefinito',
            sortAlpha: 'A-Z',
            searchTabs: 'Cerca schede...',
            spatialAudio: 'Audio Spaziale (Stanza 3D)',
            autoSuspend: 'Sospendi automaticamente schede inattive',
            suspendOff: 'Disattivato',
            suspend5m: '5 Minuti',
            suspend15m: '15 Minuti',
            suspend30m: '30 Minuti',
            suspend1h: '1 Ora',
            suspendCustom: 'Personalizzato...',
            suspendSave: 'Salva',
            suspendDelete: 'Elimina',
            suspendDeleteConfirm: 'Sei sicuro di voler eliminare la preimpostazione "{name}"?',
            suspendEnterMinutes: 'Inserisci il numero di minuti per la sospensione automatica:',
            suspendEnterName: 'Inserisci un nome per questa preimpostazione di sospensione personalizzata:',
            sessionManagement: 'Gestione Sessione',
            exportSession: 'Esporta Sessione',
            importSession: 'Importa Sessione',
            eqSave: 'Salva',
            eqDelete: 'Elimina',
            eqDeleteConfirm: 'Sei sicuro di voler eliminare la preimpostazione "{name}"?',
            eqEnterProfileName: 'Inserisci un nome per questo profilo equalizzatore personalizzato:',
            captureWarning: 'La cattura audio non è supportata sulle pagine interne del browser. Utilizza una pagina web HTTP/HTTPS.'
        },
        pl: {
            tabs: 'Karty',
            tabControls: 'Kontrola Karty',
            settings: 'Ustawienia',
            volume: 'Głośność',
            equalizer: 'Korektor graficzny',
            playbackSpeed: 'Prędkość odtwarzania',
            targetTab: 'Karta docelowa',
            currentTab: 'Bieżąca karta',
            language: 'Język',
            controlCurrentTab: 'Kontrola: Bieżąca karta',
            controllingTab: 'Kontrola: ',
            currentTabSuffix: '(Bieżąca karta)',
            theme: 'Motyw',
            themeSystem: 'Domyślny systemowy',
            themeDark: 'Ciemny',
            themeLight: 'Jasny',
            themeBlueEclipse: 'Błękitne zaćmienie',
            themeGreenJuice: 'Zielony sok',
            themeChiliSpice: 'Ostra papryczka',
            themeBloomingRomance: 'Rozkwitający romans',
            themeCaliforniaBeaches: 'Plaże Kalifornii',
            newTab: 'Nowa karta',
            eqFlat: 'Płaski',
            eqRock: 'Rock',
            eqPop: 'Pop',
            eqBassBoost: 'Wzmocnienie basów',
            eqTrebleBoost: 'Wzmocnienie tonów wysokich',
            eqAcoustic: 'Akustyczny',
            eqClassical: 'Klasyczny',
            eqElectronic: 'Elektroniczny',
            eqHipHop: 'Hip-Hop',
            eqVocalBoost: 'Wzmocnienie wokalu',
            eqCustom: 'Własny',
            pageFilters: 'Filtry strony',
            brightness: 'Jasność',
            contrast: 'Kontrast',
            saturation: 'Nasycenie',
            sepia: 'Sepia',
            grayscale: 'Skala szarości',
            filterReset: 'Resetuj',
            eqReset: 'Resetuj',
            monoAudio: 'Dźwięk mono',
            invertColors: 'Odwróć kolory',
            blueLight: 'Filtr niebieskiego światła',
            focusMask: 'Maska koncentracji / prywatności',
            sortDomain: 'Domena',
            sortDefault: 'Domyślnie',
            sortAlpha: 'A-Z',
            searchTabs: 'Szukaj kart...',
            spatialAudio: 'Dźwięk przestrzenny (Pokój 3D)',
            autoSuspend: 'Automatyczne usypianie nieaktywnych kart',
            suspendOff: 'Wyłączone',
            suspend5m: '5 minut',
            suspend15m: '15 minut',
            suspend30m: '30 minut',
            suspend1h: '1 godzina',
            suspendCustom: 'Niestandardowy...',
            suspendSave: 'Zapisz',
            suspendDelete: 'Usuń',
            suspendDeleteConfirm: 'Czy na pewno chcesz usunąć ustawienie "{name}"?',
            suspendEnterMinutes: 'Wprowadź liczbę minut dla automatycznego usypiania:',
            suspendEnterName: 'Wprowadź nazwę dla tego niestandardowego ustawienia usypiania:',
            sessionManagement: 'Zarządzanie sesjami',
            exportSession: 'Eksportuj sesję',
            importSession: 'Importuj sesję',
            eqSave: 'Zapisz',
            eqDelete: 'Usuń',
            eqDeleteConfirm: 'Czy na pewno chcesz usunąć ustawienie "{name}"?',
            eqEnterProfileName: 'Wprowadź nazwę dla tego niestandardowego profilu korektora:',
            captureWarning: 'Przechwytywanie dźwięku nie jest obsługiwane na wewnętrznych stronach przeglądarki. Użyj strony internetowej HTTP/HTTPS.'
        },
    };
    function applyTranslations(lang) {
        document.documentElement.setAttribute('lang', lang);
        const dict = translations[lang] || translations['en'];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.textContent = dict[key];
            }
        });
        const tabSearchInputUI = document.getElementById('tabSearchInput');
        if (tabSearchInputUI && dict.searchTabs) {
            tabSearchInputUI.placeholder = dict.searchTabs;
        }
    }
    let customEqProfiles = {};
    let customSuspendValues = {};
    function updateEqPresetDropdown() {
        const select = document.getElementById('eqPresetSelect');
        if (!select) return;
        const options = Array.from(select.options);
        options.forEach(opt => {
            if (opt.getAttribute('data-custom') === 'true') {
                opt.remove();
            }
        });
        for (const name in customEqProfiles) {
            const opt = document.createElement('option');
            opt.value = `custom_${name}`;
            opt.textContent = name;
            opt.setAttribute('data-custom', 'true');
            select.appendChild(opt);
        }
        if (select.rebuildCustomSelect) {
            select.rebuildCustomSelect();
        }
    }
    const handleInitResult = (result) => {
        if (!result || handleInitResult._called) return;
        handleInitResult._called = true;
        const currentLang = result.language || 'en';
        langSelect.value = currentLang;
        if (window.updateLangCustomSelectUI) window.updateLangCustomSelectUI();
        applyTranslations(currentLang);
        const currentTheme = result.theme || 'system';
        themeSelect.value = currentTheme;
        if (currentTheme !== 'system') {
            document.documentElement.setAttribute('data-theme', currentTheme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        if (themeSelect.updateCustomSelectUI) themeSelect.updateCustomSelectUI();
        const monoAudioToggle = document.getElementById('monoAudioToggle');
        if (monoAudioToggle && result.monoAudio !== undefined) {
            monoAudioToggle.checked = result.monoAudio;
        }
        const focusMaskToggle = document.getElementById('focusMaskToggle');
        if (focusMaskToggle && result.focusMask !== undefined) {
            focusMaskToggle.checked = result.focusMask;
        }
        const spatialAudioToggle = document.getElementById('spatialAudioToggle');
        if (spatialAudioToggle && result.spatialAudio !== undefined) {
            spatialAudioToggle.checked = result.spatialAudio;
        }
        const autoSuspendSelect = document.getElementById('autoSuspendSelect');
        if (autoSuspendSelect) {
            if (result.customSuspendValues) {
                Object.assign(customSuspendValues, result.customSuspendValues);
                updateSuspendDropdown();
            }
            if (result.autoSuspend !== undefined) {
                const storedVal = String(result.autoSuspend);
                let matchedValue = storedVal;
                let found = false;
                const standardOpt = autoSuspendSelect.querySelector(`option[value="${storedVal}"]`);
                if (standardOpt) {
                    found = true;
                } else {
                    for (const name in customSuspendValues) {
                        if (String(customSuspendValues[name]) === storedVal) {
                            matchedValue = `suspend_${name}`;
                            found = true;
                            const deleteSuspendBtn = document.getElementById('deleteSuspendBtn');
                            if (deleteSuspendBtn) deleteSuspendBtn.style.display = 'block';
                            break;
                        }
                    }
                }
                if (!found && parseInt(storedVal) > 0) {
                    const customInputOpt = autoSuspendSelect.querySelector('option[value="custom_input"]');
                    if (customInputOpt) {
                        customInputOpt.textContent = `Custom (${storedVal}m)`;
                        matchedValue = 'custom_input';
                        autoSuspendSelect._pendingCustomMinutes = parseInt(storedVal);
                        const saveSuspendBtn = document.getElementById('saveSuspendBtn');
                        if (saveSuspendBtn) saveSuspendBtn.style.display = 'block';
                    }
                }
                autoSuspendSelect.value = matchedValue;
                if (autoSuspendSelect.updateCustomSelectUI) autoSuspendSelect.updateCustomSelectUI();
            }
        }
        if (result.customEqProfiles) {
            Object.assign(customEqProfiles, result.customEqProfiles);
            updateEqPresetDropdown();
        }
        if (result.customBands && Array.isArray(result.customBands)) {
            customBands = result.customBands;
        }
        if (result.eqPreset) {
            eqPresetSelect.value = result.eqPreset;
            applyEqPreset(result.eqPreset);
            if (eqPresetSelect.updateCustomSelectUI) eqPresetSelect.updateCustomSelectUI();
        }
    };
    const pInit = chrome.storage.sync.get(['language', 'theme', 'eqPreset', 'customBands', 'pageFilters', 'monoAudio', 'focusMask', 'spatialAudio', 'autoSuspend', 'customEqProfiles', 'customSuspendValues'], handleInitResult);
    if (pInit && pInit instanceof Promise) pInit.then(handleInitResult).catch(console.error);
    langSelect.addEventListener('change', (e) => {
        const newLang = e.target.value;
        _browser.storage.sync.set({ language: newLang });
        if (window.updateLangCustomSelectUI) window.updateLangCustomSelectUI();
        applyTranslations(newLang);
        updateTargetTitleUI();
    });
    function initCustomSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const container = document.createElement('div');
        container.className = 'custom-select-container';
        container.id = selectId + 'CustomSelect';
        if (select.style.width) container.style.width = select.style.width;
        if (select.style.flexGrow) container.style.flexGrow = select.style.flexGrow;
        if (select.style.flexShrink) container.style.flexShrink = select.style.flexShrink;
        if (select.style.marginTop !== '') container.style.marginTop = select.style.marginTop;
        const header = document.createElement('div');
        header.className = 'custom-select-header';
        header.id = selectId + 'SelectHeader';
        const label = document.createElement('span');
        label.id = selectId + 'SelectLabel';
        header.appendChild(label);
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'dropdown-icon');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('viewBox', '0 0 16 16');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('fill-rule', 'evenodd');
        path.setAttribute('d', 'M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z');
        svg.appendChild(path);
        header.appendChild(svg);
        const dropdown = document.createElement('div');
        dropdown.className = 'custom-select-dropdown';
        dropdown.id = selectId + 'Dropdown';
        dropdown.style.display = 'none';
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'scroll-list-container dropdown-scroll-container';
        const topGradient = document.createElement('div');
        topGradient.className = 'top-gradient dropdown-top-gradient';
        const bottomGradient = document.createElement('div');
        bottomGradient.className = 'bottom-gradient dropdown-bottom-gradient';
        const scrollList = document.createElement('div');
        scrollList.className = 'scroll-list no-scrollbar';
        scrollList.id = selectId + 'DropdownList';
        scrollContainer.appendChild(topGradient);
        scrollContainer.appendChild(scrollList);
        scrollContainer.appendChild(bottomGradient);
        dropdown.appendChild(scrollContainer);
        container.appendChild(header);
        container.appendChild(dropdown);
        select.parentNode.insertBefore(container, select.nextSibling);
        let isOpen = false;
        function toggle(open) {
            if (open === isOpen) return;
            isOpen = open;
            if (isOpen) {
                document.dispatchEvent(new CustomEvent('close-all-dropdowns', { detail: { except: container } }));
                container.classList.add('open');
                dropdown.style.display = 'block';
                setTimeout(updateGradients, 50);
                setTimeout(() => {
                    const selectedItem = scrollList.querySelector('.dropdown-item.selected');
                    if (selectedItem) {
                        const wrapper = selectedItem.closest('.dropdown-item-wrapper');
                        if (wrapper) {
                            const extraMargin = 20;
                            const containerScrollTop = scrollList.scrollTop;
                            const containerHeight = scrollList.clientHeight;
                            const itemTop = wrapper.offsetTop;
                            const itemBottom = itemTop + wrapper.offsetHeight;
                            if (itemTop < containerScrollTop + extraMargin) {
                                scrollList.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' });
                            } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
                                scrollList.scrollTo({
                                    top: itemBottom - containerHeight + extraMargin,
                                    behavior: 'smooth'
                                });
                            }
                        }
                    }
                }, 50);
            } else {
                container.classList.remove('open');
                dropdown.style.display = 'none';
            }
        }
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle(!isOpen);
        });
        document.addEventListener('click', (e) => {
            if (isOpen && !container.contains(e.target)) {
                toggle(false);
            }
        });
        document.addEventListener('close-all-dropdowns', (e) => {
            if (e.detail.except !== container) {
                toggle(false);
            }
        });
        function updateGradients() {
            const scrollTop = scrollList.scrollTop;
            const scrollHeight = scrollList.scrollHeight;
            const clientHeight = scrollList.clientHeight;
            topGradient.style.opacity = Math.min(scrollTop / 50, 1);
            const bottomDistance = scrollHeight - (scrollTop + clientHeight);
            bottomGradient.style.opacity = scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1);
        }
        scrollList.addEventListener('scroll', updateGradients);
        function rebuild() {
            scrollList.innerHTML = '';
            Array.from(select.options).forEach((option) => {
                const itemWrapper = document.createElement('div');
                itemWrapper.className = 'dropdown-item-wrapper';
                itemWrapper.dataset.value = option.value;
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                if (select.value === option.value) {
                    item.classList.add('selected');
                }
                const text = document.createElement('p');
                text.className = 'dropdown-item-text';
                text.textContent = option.textContent;
                const i18nKey = option.getAttribute('data-i18n');
                if (i18nKey) {
                    text.setAttribute('data-i18n', i18nKey);
                }
                item.appendChild(text);
                itemWrapper.appendChild(item);
                itemWrapper.addEventListener('click', (e) => {
                    e.stopPropagation();
                    select.value = option.value;
                    select.dispatchEvent(new Event('change'));
                    toggle(false);
                });
                scrollList.appendChild(itemWrapper);
            });
            updateUI();
        }
        function updateUI() {
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption) {
                label.textContent = selectedOption.textContent;
                const i18nKey = selectedOption.getAttribute('data-i18n');
                if (i18nKey) {
                    label.setAttribute('data-i18n', i18nKey);
                } else {
                    label.removeAttribute('data-i18n');
                }
            }
            const wrappers = scrollList.querySelectorAll('.dropdown-item-wrapper');
            wrappers.forEach(wr => {
                const item = wr.querySelector('.dropdown-item');
                if (wr.dataset.value === select.value) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }
        select.addEventListener('change', updateUI);
        rebuild();
        select.rebuildCustomSelect = rebuild;
        select.toggleCustomSelect = toggle;
        select.updateCustomSelectUI = updateUI;
    }
    const langFlags = {
        en: { name: 'English', svg: `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'%3E%3CclipPath id='s'%3E%3Cpath d='M0,0 v30 h60 v-30 z'/%3E%3C/clipPath%3E%3CclipPath id='t'%3E%3Cpath d='M0,0 L60,30 M60,0 L0,30'/%3E%3C/clipPath%3E%3Cpath d='M0,0 v30 h60 v-30 z' fill='%23012169'/%3E%3Cpath d='M0,0 L60,30 M60,0 L0,30' stroke='%23fff' stroke-width='6' clip-path='url(%23s)'/%3E%3Cpath d='M0,0 L60,30 M60,0 L0,30' stroke='%23C8102E' stroke-width='4' clip-path='url(%23t)'/%3E%3Cpath d='M30,0 v30 M0,15 h60' stroke='%23fff' stroke-width='10'/%3E%3Cpath d='M30,0 v30 M0,15 h60' stroke='%23C8102E' stroke-width='6'/%3E%3C/svg%3E` },
        uk: { name: 'Українська', svg: `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='3' height='1' fill='%230057B7'/%3E%3Crect y='1' width='3' height='1' fill='%23FFD700'/%3E%3C/svg%3E` },
        es: { name: 'Español', svg: `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='3' height='2' fill='%23C8102E'/%3E%3Crect y='0.5' width='3' height='1' fill='%23FFD700'/%3E%3Ccircle cx='0.8' cy='1' r='0.15' fill='%23C8102E'/%3E%3C/svg%3E` },
        fr: { name: 'Français', svg: `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='1' height='2' fill='%2300209F'/%3E%3Crect x='1' width='1' height='2' fill='%23FFF'/%3E%3Crect x='2' width='1' height='2' fill='%23F42A41'/%3E%3C/svg%3E` },
        de: { name: 'Deutsch', svg: `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 5 3'%3E%3Crect width='5' height='1' fill='%23000'/%3E%3Crect y='1' width='5' height='1' fill='%23D00'/%3E%3Crect y='2' width='5' height='1' fill='%23FFCE00'/%3E%3C/svg%3E` },
        pt: { name: 'Português', svg: `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='1.2' height='2' fill='%23006600'/%3E%3Crect x='1.2' width='1.8' height='2' fill='%23FF0000'/%3E%3Ccircle cx='1.2' cy='1' r='0.3' fill='%23FFCC00'/%3E%3Ccircle cx='1.2' cy='1' r='0.2' fill='%23FF0000'/%3E%3C/svg%3E` },
        it: { name: 'Italiano', svg: `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='1' height='2' fill='%23009246'/%3E%3Crect x='1' width='1' height='2' fill='%23FFF'/%3E%3Crect x='2' width='1' height='2' fill='%23CE2B37'/%3E%3C/svg%3E` },
        pl: { name: 'Polski', svg: `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 5'%3E%3Crect width='8' height='2.5' fill='%23FFF'/%3E%3Crect y='2.5' width='8' height='2.5' fill='%23DC143C'/%3E%3C/svg%3E` }
    };
    function initLangCustomSelect() {
        const langSelectHeader = document.getElementById('langSelectHeader');
        const langSelectLabel = document.getElementById('langSelectLabel');
        const langDropdown = document.getElementById('langDropdown');
        const langDropdownList = document.getElementById('langDropdownList');
        const langCustomSelect = document.getElementById('langCustomSelect');
        if (!langSelect || !langSelectHeader || !langDropdownList) return;
        let isLangDropdownOpen = false;
        langDropdownList.innerHTML = '';
        Object.keys(langFlags).forEach(code => {
            const itemWrapper = document.createElement('div');
            itemWrapper.className = 'dropdown-item-wrapper';
            itemWrapper.dataset.langCode = code;
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            if (langSelect.value === code) {
                item.classList.add('selected');
            }
            const img = document.createElement('img');
            img.className = 'dropdown-item-icon';
            img.src = langFlags[code].svg;
            img.alt = langFlags[code].name;
            img.style.borderRadius = '2px';
            img.style.boxShadow = '0 0 1px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.2)';
            const text = document.createElement('p');
            text.className = 'dropdown-item-text';
            text.textContent = langFlags[code].name;
            item.appendChild(img);
            item.appendChild(text);
            itemWrapper.appendChild(item);
            itemWrapper.addEventListener('click', (e) => {
                e.stopPropagation();
                langSelect.value = code;
                langSelect.dispatchEvent(new Event('change'));
                toggleLangDropdown(false);
            });
            langDropdownList.appendChild(itemWrapper);
        });
        langSelectHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLangDropdown(!isLangDropdownOpen);
        });
        document.addEventListener('click', (e) => {
            if (isLangDropdownOpen && !langCustomSelect.contains(e.target)) {
                toggleLangDropdown(false);
            }
        });
        document.addEventListener('close-all-dropdowns', (e) => {
            if (e.detail.except !== langCustomSelect) {
                toggleLangDropdown(false);
            }
        });
        function toggleLangDropdown(open) {
            isLangDropdownOpen = open;
            if (open) {
                document.dispatchEvent(new CustomEvent('close-all-dropdowns', { detail: { except: langCustomSelect } }));
                langCustomSelect.classList.add('open');
                langDropdown.style.display = 'block';
            } else {
                langCustomSelect.classList.remove('open');
                langDropdown.style.display = 'none';
            }
        }
        window.updateLangCustomSelectUI = function () {
            const currentCode = langSelect.value || 'en';
            langSelectLabel.innerHTML = '';
            const img = document.createElement('img');
            img.className = 'dropdown-item-icon';
            img.src = langFlags[currentCode].svg;
            img.alt = langFlags[currentCode].name;
            img.style.borderRadius = '2px';
            img.style.boxShadow = '0 0 1px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.2)';
            const span = document.createElement('span');
            span.textContent = langFlags[currentCode].name;
            langSelectLabel.appendChild(img);
            langSelectLabel.appendChild(span);
            const wrappers = langDropdownList.querySelectorAll('.dropdown-item-wrapper');
            wrappers.forEach(wr => {
                const item = wr.querySelector('.dropdown-item');
                if (wr.dataset.langCode === currentCode) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        };
        window.updateLangCustomSelectUI();
    }
    initLangCustomSelect();
    initCustomSelect('tabSortSelect');
    initCustomSelect('eqPresetSelect');
    initCustomSelect('themeSelect');
    initCustomSelect('autoSuspendSelect');
    themeSelect.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        _browser.storage.sync.set({ theme: newTheme });
        if (newTheme !== 'system') {
            document.documentElement.setAttribute('data-theme', newTheme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    });
    function showModal({ message, hasInput = false, inputType = 'text', placeholder = '', confirmText = 'OK', cancelText = 'Cancel' }) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('customModal');
            const msgEl = document.getElementById('modalMessage');
            const inputEl = document.getElementById('modalInput');
            const confirmBtn = document.getElementById('modalConfirmBtn');
            const cancelBtn = document.getElementById('modalCancelBtn');
            if (!overlay || !msgEl || !inputEl || !confirmBtn || !cancelBtn) {
                if (hasInput) { resolve(prompt(message)); } else { resolve(confirm(message) ? '' : null); }
                return;
            }
            msgEl.textContent = message;
            confirmBtn.textContent = confirmText;
            cancelBtn.textContent = cancelText;
            if (hasInput) {
                inputEl.type = inputType;
                inputEl.placeholder = placeholder;
                inputEl.value = '';
                inputEl.style.display = 'block';
            } else {
                inputEl.style.display = 'none';
            }
            overlay.style.display = 'flex';
            if (hasInput) setTimeout(() => inputEl.focus(), 50);
            function cleanup() {
                overlay.style.display = 'none';
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onOverlayClick);
                inputEl.removeEventListener('keydown', onKeydown);
            }
            function onConfirm() {
                cleanup();
                resolve(hasInput ? inputEl.value : '');
            }
            function onCancel() {
                cleanup();
                resolve(null);
            }
            function onOverlayClick(e) {
                if (e.target === overlay) onCancel();
            }
            function onKeydown(e) {
                if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
                if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            }
            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            overlay.addEventListener('click', onOverlayClick);
            inputEl.addEventListener('keydown', onKeydown);
        });
    }
    function updateSuspendDropdown() {
        const select = document.getElementById('autoSuspendSelect');
        if (!select) return;
        Array.from(select.options).forEach(opt => {
            if (opt.getAttribute('data-custom-suspend') === 'true') opt.remove();
        });
        const customInputOpt = select.querySelector('option[value="custom_input"]');
        for (const name in customSuspendValues) {
            const opt = document.createElement('option');
            opt.value = `suspend_${name}`;
            opt.textContent = `${customSuspendValues[name]} Minutes`;
            opt.setAttribute('data-custom-suspend', 'true');
            if (customInputOpt) {
                select.insertBefore(opt, customInputOpt);
            } else {
                select.appendChild(opt);
            }
        }
        if (select.rebuildCustomSelect) select.rebuildCustomSelect();
    }
    const autoSuspendSelect = document.getElementById('autoSuspendSelect');
    if (autoSuspendSelect) {
        autoSuspendSelect.addEventListener('change', async (e) => {
            const val = e.target.value;
            const saveSuspendBtn = document.getElementById('saveSuspendBtn');
            const deleteSuspendBtn = document.getElementById('deleteSuspendBtn');
            if (val === 'custom_input') {
                const currentLang = langSelect ? langSelect.value : 'en';
                const dict = translations[currentLang] || translations['en'];
                const result = await showModal({
                    message: dict.suspendEnterMinutes || 'Enter the number of minutes for auto-suspend:',
                    hasInput: true,
                    inputType: 'number',
                    placeholder: 'e.g. 45',
                    confirmText: dict.suspendSave || 'Save',
                    cancelText: 'Cancel'
                });
                const minutes = parseInt(result);
                if (result !== null && !isNaN(minutes) && minutes > 0) {
                    autoSuspendSelect._pendingCustomMinutes = minutes;
                    const customInputOpt = autoSuspendSelect.querySelector('option[value="custom_input"]');
                    if (customInputOpt) customInputOpt.textContent = `Custom (${minutes}m)`;
                    autoSuspendSelect.value = 'custom_input';
                    if (autoSuspendSelect.updateCustomSelectUI) autoSuspendSelect.updateCustomSelectUI();
                    if (saveSuspendBtn) saveSuspendBtn.style.display = 'block';
                    if (deleteSuspendBtn) deleteSuspendBtn.style.display = 'none';
                    chrome.storage.sync.set({ autoSuspend: minutes });
                } else {
                    autoSuspendSelect.value = autoSuspendSelect._lastValue || '0';
                    if (autoSuspendSelect.updateCustomSelectUI) autoSuspendSelect.updateCustomSelectUI();
                }
            } else if (val.startsWith('suspend_')) {
                const name = val.substring(8);
                const minutes = customSuspendValues[name];
                autoSuspendSelect._lastValue = val;
                if (saveSuspendBtn) saveSuspendBtn.style.display = 'none';
                if (deleteSuspendBtn) deleteSuspendBtn.style.display = 'block';
                if (minutes !== undefined) chrome.storage.sync.set({ autoSuspend: minutes });
            } else {
                autoSuspendSelect._lastValue = val;
                if (saveSuspendBtn) saveSuspendBtn.style.display = 'none';
                if (deleteSuspendBtn) deleteSuspendBtn.style.display = 'none';
                const numVal = parseInt(val);
                if (!isNaN(numVal)) chrome.storage.sync.set({ autoSuspend: numVal });
            }
        });
    }
    const saveSuspendBtn = document.getElementById('saveSuspendBtn');
    if (saveSuspendBtn) {
        saveSuspendBtn.addEventListener('click', () => {
            const currentLang = langSelect ? langSelect.value : 'en';
            const dict = translations[currentLang] || translations['en'];
            const pendingMinutes = autoSuspendSelect ? autoSuspendSelect._pendingCustomMinutes : null;
            if (!pendingMinutes) return;
            const cleanName = `${pendingMinutes}m`;
            customSuspendValues[cleanName] = pendingMinutes;
            chrome.storage.sync.set({ customSuspendValues });
            updateSuspendDropdown();
            autoSuspendSelect.value = `suspend_${cleanName}`;
            chrome.storage.sync.set({ autoSuspend: pendingMinutes });
            if (autoSuspendSelect.updateCustomSelectUI) autoSuspendSelect.updateCustomSelectUI();
            saveSuspendBtn.style.display = 'none';
            const deleteSuspendBtn = document.getElementById('deleteSuspendBtn');
            if (deleteSuspendBtn) deleteSuspendBtn.style.display = 'block';
            const customInputOpt = autoSuspendSelect.querySelector('option[value="custom_input"]');
            if (customInputOpt) customInputOpt.textContent = dict.suspendCustom || 'Custom...';
        });
    }
    const deleteSuspendBtn = document.getElementById('deleteSuspendBtn');
    if (deleteSuspendBtn) {
        deleteSuspendBtn.addEventListener('click', async () => {
            const currentVal = autoSuspendSelect ? autoSuspendSelect.value : '';
            if (currentVal && currentVal.startsWith('suspend_')) {
                const name = currentVal.substring(8);
                const currentLang = langSelect ? langSelect.value : 'en';
                const dict = translations[currentLang] || translations['en'];
                const confirmMsg = (dict.suspendDeleteConfirm || 'Are you sure you want to delete the suspend preset "{name}"?').replace('{name}', name);
                const result = await showModal({
                    message: confirmMsg,
                    hasInput: false,
                    confirmText: dict.suspendDelete || 'Delete',
                    cancelText: 'Cancel'
                });
                if (result !== null) {
                    delete customSuspendValues[name];
                    chrome.storage.sync.set({ customSuspendValues });
                    updateSuspendDropdown();
                    autoSuspendSelect.value = '0';
                    chrome.storage.sync.set({ autoSuspend: 0 });
                    if (autoSuspendSelect.updateCustomSelectUI) autoSuspendSelect.updateCustomSelectUI();
                    deleteSuspendBtn.style.display = 'none';
                }
            }
        });
    }
    const exportSessionBtn = document.getElementById('exportSessionBtn');
    if (exportSessionBtn) {
        exportSessionBtn.addEventListener('click', async () => {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const sessionData = tabs.map(t => ({ url: t.url, title: t.title }));
            const settingsKeys = ['language', 'theme', 'eqPreset', 'customBands', 'pageFilters', 'monoAudio', 'focusMask', 'spatialAudio', 'autoSuspend', 'customEqProfiles'];
            const settings = await chrome.storage.sync.get(settingsKeys);
            const exportData = {
                tabs: sessionData,
                settings: settings
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({ url, filename: `betterplayer_session_${Date.now()}.json` });
        });
    }
    const importSessionBtn = document.getElementById('importSessionBtn');
    const importSessionFile = document.getElementById('importSessionFile');
    if (importSessionBtn && importSessionFile) {
        importSessionBtn.addEventListener('click', () => importSessionFile.click());
        importSessionFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const parsedData = JSON.parse(ev.target.result);
                    let tabsData = [];
                    if (Array.isArray(parsedData)) {
                        tabsData = parsedData;
                    } else if (parsedData && typeof parsedData === 'object') {
                        tabsData = parsedData.tabs || [];
                        if (parsedData.settings) {
                            await chrome.storage.sync.set(parsedData.settings);
                            window.location.reload();
                        }
                    }
                    tabsData.forEach(tab => chrome.tabs.create({ url: tab.url, active: false }));
                } catch (err) {
                    console.error("Invalid session file");
                }
            };
            reader.readAsText(file);
        });
    }
    function applyPageFilters(filterValues) {
        const parts = [];
        if (filterValues.brightness != null) parts.push(`brightness(${filterValues.brightness}%)`);
        if (filterValues.contrast != null) parts.push(`contrast(${filterValues.contrast}%)`);
        if (filterValues.saturate != null) parts.push(`saturate(${filterValues.saturate}%)`);
        if (filterValues.sepia != null) parts.push(`sepia(${filterValues.sepia}%)`);
        if (filterValues.grayscale != null) parts.push(`grayscale(${filterValues.grayscale}%)`);
        if (filterValues.invert) parts.push(`invert(1)`);
        if (filterValues.blueLight) parts.push(`sepia(60%) hue-rotate(320deg) saturate(150%)`);
        document.documentElement.style.filter = parts.length > 0 ? parts.join(' ') : '';
    }
    function focusMaskLogic(enable) {
        if (enable) {
            if (!window.__betterplayer_mask) {
                const mask = document.createElement('div');
                mask.id = 'betterplayer-privacy-mask';
                mask.style.position = 'fixed';
                mask.style.top = '0';
                mask.style.left = '0';
                mask.style.width = '100vw';
                mask.style.height = '100vh';
                mask.style.pointerEvents = 'none';
                mask.style.zIndex = '2147483647';
                mask.style.transition = 'backdrop-filter 0.1s';
                mask.style.backdropFilter = 'blur(10px)';
                mask.style.maskImage = 'radial-gradient(circle 150px at 50% 50%, transparent 80%, black 100%)';
                mask.style.webkitMaskImage = 'radial-gradient(circle 150px at 50% 50%, transparent 80%, black 100%)';
                document.body.appendChild(mask);
                window.__betterplayer_mask = mask;
                window.__betterplayer_mask_fn = (e) => {
                    if (window.__betterplayer_mask) {
                        const maskStr = `radial-gradient(circle 150px at ${e.clientX}px ${e.clientY}px, transparent 80%, black 100%)`;
                        window.__betterplayer_mask.style.maskImage = maskStr;
                        window.__betterplayer_mask.style.webkitMaskImage = maskStr;
                    }
                };
                document.addEventListener('mousemove', window.__betterplayer_mask_fn);
            }
        } else {
            if (window.__betterplayer_mask) {
                document.removeEventListener('mousemove', window.__betterplayer_mask_fn);
                window.__betterplayer_mask.remove();
                window.__betterplayer_mask = null;
                window.__betterplayer_mask_fn = null;
            }
        }
    }
    const filterSliders = {};
    const filterCounters = {};
    const filterDefaults = {
        brightness: 100,
        contrast: 100,
        saturate: 100,
        sepia: 0,
        grayscale: 0,
        invert: false,
        blueLight: false,
        focusMask: false
    };
    const invertToggle = document.getElementById('invertToggle');
    const blueLightToggle = document.getElementById('blueLightToggle');
    const focusMaskToggle = document.getElementById('focusMaskToggle');
    const debouncedSaveFilters = debounce((filterValues, focusMaskChecked) => {
        chrome.storage.sync.set({ pageFilters: filterValues, focusMask: focusMaskChecked });
    }, 1000);
    const debouncedApplyFilters = debounce(() => {
        const filterValues = {};
        for (const key in filterSliders) {
            filterValues[key] = Math.round(filterSliders[key].value);
        }
        if (invertToggle && invertToggle.checked) filterValues.invert = true;
        if (blueLightToggle && blueLightToggle.checked) filterValues.blueLight = true;
        executeScriptOnTargetTab(applyPageFilters, [filterValues]);
        if (focusMaskToggle) {
            executeScriptOnTargetTab(focusMaskLogic, [focusMaskToggle.checked]);
        }
        debouncedSaveFilters(filterValues, focusMaskToggle ? focusMaskToggle.checked : false);
    }, 75);
    [invertToggle, blueLightToggle, focusMaskToggle].forEach(toggle => {
        if (toggle) toggle.addEventListener('change', debouncedApplyFilters);
    });
    const filterConfig = [
        { key: 'brightness', container: 'brightnessSliderContainer', valueEl: 'brightnessValue', min: 0, max: 200, def: 100, step: 1 },
        { key: 'contrast', container: 'contrastSliderContainer', valueEl: 'contrastValue', min: 0, max: 200, def: 100, step: 1 },
        { key: 'saturate', container: 'saturationSliderContainer', valueEl: 'saturationValue', min: 0, max: 200, def: 100, step: 1 },
        { key: 'sepia', container: 'sepiaSliderContainer', valueEl: 'sepiaValue', min: 0, max: 100, def: 0, step: 1 },
        { key: 'grayscale', container: 'grayscaleSliderContainer', valueEl: 'grayscaleValue', min: 0, max: 100, def: 0, step: 1 }
    ];
    const iconFilterLow = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3"/></svg>`;
    const iconFilterHigh = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/></svg>`;
    filterConfig.forEach(cfg => {
        const containerEl = document.getElementById(cfg.container);
        const valueEl = document.getElementById(cfg.valueEl);
        if (!containerEl || !valueEl) return;
        valueEl.innerHTML = '';
        const valSpan = document.createElement('span');
        valSpan.style.background = 'transparent';
        valSpan.style.color = 'inherit';
        valSpan.style.padding = '0';
        valSpan.style.marginLeft = '0';
        valueEl.appendChild(valSpan);
        const counter = new AnimatedCounter(valSpan, { fontSize: 12 });
        counter.setValue(`${cfg.def}%`, true);
        filterCounters[cfg.key] = counter;
        const slider = new ElasticSlider(containerEl, {
            min: cfg.min,
            max: cfg.max,
            value: cfg.def,
            step: cfg.step,
            leftIconSVG: iconFilterLow,
            rightIconSVG: iconFilterHigh,
            onChange: (val) => {
                counter.setValue(`${Math.round(val)}%`);
                debouncedApplyFilters();
            },
            onFormatValue: (val) => {
                counter.setValue(`${Math.round(val)}%`, true);
            }
        });
        filterSliders[cfg.key] = slider;
    });
    const handleFiltersResult = (result) => {
        if (!result || handleFiltersResult._called) return;
        handleFiltersResult._called = true;
        if (result.pageFilters) {
            const pf = result.pageFilters;
            for (const key in pf) {
                if (filterSliders[key]) {
                    filterSliders[key].setValue(pf[key]);
                    if (filterCounters[key]) filterCounters[key].setValue(`${Math.round(pf[key])}%`, true);
                }
            }
            if (invertToggle && pf.invert !== undefined) invertToggle.checked = pf.invert;
            if (blueLightToggle && pf.blueLight !== undefined) blueLightToggle.checked = pf.blueLight;
        }
    };
    const pFilters = _browser.storage.sync.get(['pageFilters'], handleFiltersResult);
    if (pFilters && pFilters instanceof Promise) pFilters.then(handleFiltersResult).catch(console.error);
    const filterResetBtn = document.getElementById('filterResetBtn');
    if (filterResetBtn) {
        filterResetBtn.addEventListener('click', () => {
            for (const key in filterDefaults) {
                if (filterSliders[key]) {
                    filterSliders[key].setValue(filterDefaults[key]);
                    filterCounters[key].setValue(`${filterDefaults[key]}%`, true);
                }
            }
            if (invertToggle) invertToggle.checked = filterDefaults.invert;
            if (blueLightToggle) blueLightToggle.checked = filterDefaults.blueLight;
            if (focusMaskToggle) focusMaskToggle.checked = filterDefaults.focusMask;
            debouncedApplyFilters();
        });
    }
    function applyMediaSettings(volume, speed) {
        const mediaElements = document.querySelectorAll('video, audio');
        mediaElements.forEach(media => {
            if (volume !== null) media.volume = volume;
            if (speed !== null) media.playbackRate = speed;
        });
    }
    let targetTabId = null;
    let activeTabId = null;
    let activeTabTitle = '';
    let activeTabUrl = '';
    let currentTargetTitle = '';
    let isCurrentTabTarget = true;
    function updateTargetTitleUI() {
        const currentLang = langSelect.value;
        const dict = translations[currentLang] || translations['en'];
        if (currentTargetTitle) {
            let titleStr = currentTargetTitle;
            if (isCurrentTabTarget) {
                titleStr = `${currentTargetTitle} ${dict.currentTabSuffix || '(Current Tab)'}`;
            }
            const targetTabTitleText = document.getElementById('targetTabTitleText');
            if (targetTabTitleText) {
                targetTabTitleText.textContent = titleStr;
            }
        }
    }
    function updateCaptureWarning() {
        const actualTabId = targetTabId || activeTabId;
        let url = '';
        if (actualTabId === activeTabId) {
            url = activeTabUrl;
        } else {
            const tab = tabs.find(t => t.id === actualTabId);
            if (tab) {
                url = tab.url || '';
            }
        }
        const banner = document.getElementById('captureWarningBanner');
        if (!banner) return;
        if (!url) {
            banner.style.display = 'none';
            return;
        }
        const isRestricted = url.startsWith('chrome://') ||
            url.startsWith('chrome-extension://') ||
            url.startsWith('about:') ||
            url.startsWith('edge://') ||
            url.includes('chrome.google.com/webstore') ||
            url.includes('chromewebstore.google.com');
        banner.style.display = isRestricted ? 'flex' : 'none';
    }
    async function executeScriptOnTargetTab(func, args) {
        try {
            const actualTabId = targetTabId || activeTabId;
            if (actualTabId) {
                await _browser.scripting.executeScript({
                    target: { tabId: actualTabId, allFrames: true },
                    func: func,
                    args: args
                });
            }
        } catch (e) {
            console.error('Error executing script:', e);
        }
    }
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    const debouncedApplyMediaSettings = debounce((val, type) => {
        executeScriptOnTargetTab(applyMediaSettings, type === 'volume' ? [val, null] : [null, val]);
    }, 75);
    let currentCapturedTabId = null;
    async function ensureOffscreenDocument() {
        const hasDoc = await chrome.offscreen.hasDocument().catch(() => false);
        if (!hasDoc) {
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['USER_MEDIA'],
                justification: 'Capturing tab audio for equalizer processing'
            });
        }
    }
    function startCaptureForTab(tabId) {
        if (currentCapturedTabId === tabId) return Promise.resolve();
        return new Promise((resolve, reject) => {
            try {
                chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, async (streamId) => {
                    if (chrome.runtime.lastError || !streamId) {
                        const errMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : "No streamId returned";
                        console.error("Error getting streamId:", errMsg);
                        reject(new Error(errMsg));
                        return;
                    }
                    try {
                        await ensureOffscreenDocument();
                        const bands = getEqBands();
                        const monoAudioToggle = document.getElementById('monoAudioToggle');
                        const isMono = monoAudioToggle ? monoAudioToggle.checked : false;
                        const spatialAudioToggle = document.getElementById('spatialAudioToggle');
                        const isSpatial = spatialAudioToggle ? spatialAudioToggle.checked : false;
                        chrome.runtime.sendMessage({
                            type: 'start-capture',
                            tabId: tabId,
                            streamId: streamId,
                            bands,
                            isMono,
                            isSpatial
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                reject(chrome.runtime.lastError);
                                return;
                            }
                            if (response && response.success) {
                                currentCapturedTabId = tabId;
                                resolve();
                            } else {
                                reject(new Error(response ? response.error : "Failed to start capture in offscreen"));
                            }
                        });
                    } catch (err) {
                        console.error("Failed to ensure offscreen document or send start-capture message:", err.message || err);
                        reject(err);
                    }
                });
            } catch (err) {
                console.error("Failed to start tab capture:", err.message || err);
                reject(err);
            }
        });
    }
    const eqCounters = [];
    const eqSliders = [];
    const eqResetBtn = document.getElementById('eqResetBtn');
    function getEqBands() {
        return eqSliders.map(slider => parseFloat(slider.value));
    }
    const debouncedSaveEq = debounce((bands, isMono, isSpatial, currentPreset) => {
        const dataToSave = {
            monoAudio: isMono,
            spatialAudio: isSpatial,
            eqPreset: currentPreset
        };
        if (currentPreset === 'custom') {
            dataToSave.customBands = bands;
        }
        chrome.storage.sync.set(dataToSave);
    }, 1000);
    const debouncedApplyEq = debounce(async () => {
        const bands = getEqBands();
        const monoAudioToggle = document.getElementById('monoAudioToggle');
        const isMono = monoAudioToggle ? monoAudioToggle.checked : false;
        const spatialAudioToggle = document.getElementById('spatialAudioToggle');
        const isSpatial = spatialAudioToggle ? spatialAudioToggle.checked : false;
        const actualTabId = targetTabId || activeTabId;
        if (actualTabId && currentCapturedTabId === actualTabId) {
            chrome.runtime.sendMessage({
                type: 'update-eq',
                bands,
                isMono,
                isSpatial
            });
        }
        const currentPreset = eqPresetSelect ? eqPresetSelect.value : 'flat';
        debouncedSaveEq(bands, isMono, isSpatial, currentPreset);
    }, 75);
    const monoAudioToggle = document.getElementById('monoAudioToggle');
    if (monoAudioToggle) {
        monoAudioToggle.addEventListener('change', () => {
            const actualTabId = targetTabId || activeTabId;
            if (actualTabId) {
                startCaptureForTab(actualTabId).then(() => {
                    debouncedApplyEq();
                }).catch(err => {
                    console.error("Failed startCaptureForTab in monoAudioToggle change listener:", err.message || err);
                    debouncedApplyEq();
                });
            } else {
                debouncedApplyEq();
            }
        });
    }
    const spatialAudioToggle = document.getElementById('spatialAudioToggle');
    if (spatialAudioToggle) {
        spatialAudioToggle.addEventListener('change', () => {
            const actualTabId = targetTabId || activeTabId;
            if (actualTabId) {
                startCaptureForTab(actualTabId).then(() => {
                    debouncedApplyEq();
                }).catch(err => {
                    console.error("Failed startCaptureForTab in spatialAudioToggle change listener:", err.message || err);
                    debouncedApplyEq();
                });
            } else {
                debouncedApplyEq();
            }
        });
    }
    const eqBandsContainer = document.querySelector('.eq-bands-container');
    if (eqBandsContainer) {
        eqBandsContainer.addEventListener('pointerdown', () => {
            const actualTabId = targetTabId || activeTabId;
            if (actualTabId) {
                startCaptureForTab(actualTabId).catch(err => {
                    console.error("Failed startCaptureForTab in eqBandsContainer pointerdown listener:", err.message || err);
                });
            }
        });
    }
    for (let i = 0; i < 10; i++) {
        const container = document.getElementById(`eqSliderContainer-${i}`);
        const eqValEl = document.getElementById(`eqVal-${i}`);
        eqValEl.innerHTML = '';
        const eqSpan = document.createElement('span');
        eqSpan.style.background = 'transparent';
        eqSpan.style.color = 'inherit';
        eqSpan.style.padding = '0';
        eqSpan.style.marginLeft = '0';
        eqValEl.appendChild(eqSpan);
        const counter = new AnimatedCounter(eqSpan, { fontSize: 10 });
        eqCounters.push(counter);
        const slider = new ElasticSlider(container, {
            orientation: 'vertical',
            min: -12,
            max: 12,
            value: 0,
            step: 1,
            onChange: (val) => {
                counter.setValue(`${val > 0 ? '+' : ''}${parseFloat(val).toFixed(0)}dB`);
                if (!eqPresetLocked && eqPresetSelect) {
                    eqPresetSelect.value = 'custom';
                    if (eqPresetSelect.updateCustomSelectUI) eqPresetSelect.updateCustomSelectUI();
                    customBands = getEqBands();
                    const saveEqBtn = document.getElementById('saveEqBtn');
                    if (saveEqBtn) saveEqBtn.style.display = 'block';
                    const deleteEqBtn = document.getElementById('deleteEqBtn');
                    if (deleteEqBtn) deleteEqBtn.style.display = 'none';
                }
                debouncedApplyEq();
            }
        });
        eqSliders.push(slider);
    }
    const eqPresets = {
        flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        rock: [+5, +4, +2, 0, -2, -1, +1, +3, +4, +5],
        pop: [-2, -1, +1, +3, +4, +4, +3, +2, 0, -1],
        bassBoost: [+6, +5, +4, +2, 0, 0, 0, 0, 0, 0],
        trebleBoost: [0, 0, 0, 0, 0, 0, +2, +3, +4, +5],
        acoustic: [+3, +2, +1, 0, 0, +1, +2, +2, +3, +2],
        classical: [+3, +2, +1, 0, -1, -1, 0, 0, +3, +4],
        electronic: [+6, +4, +2, 0, -2, -1, +1, +3, +4, +5],
        hiphop: [+5, +4, +2, 0, -1, -1, 0, +1, +2, +3],
        vocalBoost: [-2, -2, -1, +1, +3, +4, +3, +1, -1, -2]
    };
    const eqPresetSelect = document.getElementById('eqPresetSelect');
    let eqPresetLocked = false;
    let customBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    function applyEqPreset(presetName) {
        let bands = eqPresets[presetName];
        if (!bands) {
            if (presetName === 'custom') {
                bands = customBands;
            } else if (presetName.startsWith('custom_')) {
                const name = presetName.substring(7);
                bands = customEqProfiles[name] || customBands;
            }
        }
        if (!bands) return;
        eqPresetLocked = true;
        bands.forEach((gain, i) => {
            if (eqSliders[i]) {
                eqSliders[i].setValue(gain);
                eqCounters[i].setValue(`${gain > 0 ? '+' : ''}${gain}dB`);
            }
        });
        eqPresetLocked = false;
        debouncedApplyEq();
        const saveEqBtn = document.getElementById('saveEqBtn');
        if (saveEqBtn) {
            saveEqBtn.style.display = presetName === 'custom' ? 'block' : 'none';
        }
        const deleteEqBtn = document.getElementById('deleteEqBtn');
        if (deleteEqBtn) {
            deleteEqBtn.style.display = presetName.startsWith('custom_') ? 'block' : 'none';
        }
    }
    eqPresetSelect.addEventListener('change', () => {
        const preset = eqPresetSelect.value;
        const actualTabId = targetTabId || activeTabId;
        const applyAction = () => {
            applyEqPreset(preset);
            chrome.storage.sync.set({ eqPreset: preset });
        };
        if (actualTabId) {
            startCaptureForTab(actualTabId).then(applyAction).catch(err => {
                console.error("Failed startCaptureForTab in eqPresetSelect change listener:", err.message || err);
                applyAction();
            });
        } else {
            applyAction();
        }
    });
    const saveEqBtn = document.getElementById('saveEqBtn');
    if (saveEqBtn) {
        saveEqBtn.addEventListener('click', () => {
            const currentLang = langSelect.value;
            const dict = translations[currentLang] || translations['en'];
            const name = prompt(dict.eqEnterProfileName || "Enter a name for this custom EQ profile:");
            if (name && name.trim().length > 0) {
                const cleanName = name.trim();
                customEqProfiles[cleanName] = getEqBands();
                chrome.storage.sync.set({ customEqProfiles });
                updateEqPresetDropdown();
                eqPresetSelect.value = `custom_${cleanName}`;
                chrome.storage.sync.set({ eqPreset: `custom_${cleanName}` });
                if (eqPresetSelect.updateCustomSelectUI) eqPresetSelect.updateCustomSelectUI();
                saveEqBtn.style.display = 'none';
            }
        });
    }
    const deleteEqBtn = document.getElementById('deleteEqBtn');
    if (deleteEqBtn) {
        deleteEqBtn.addEventListener('click', () => {
            const currentPreset = eqPresetSelect.value;
            if (currentPreset && currentPreset.startsWith('custom_')) {
                const name = currentPreset.substring(7);
                const currentLang = langSelect.value;
                const dict = translations[currentLang] || translations['en'];
                const confirmMsg = (dict.eqDeleteConfirm || 'Are you sure you want to delete the preset "{name}"?').replace('{name}', name);
                if (confirm(confirmMsg)) {
                    delete customEqProfiles[name];
                    chrome.storage.sync.set({ customEqProfiles });
                    updateEqPresetDropdown();
                    eqPresetSelect.value = 'flat';
                    applyEqPreset('flat');
                    chrome.storage.sync.set({ eqPreset: 'flat' });
                    if (eqPresetSelect.updateCustomSelectUI) eqPresetSelect.updateCustomSelectUI();
                }
            }
        });
    }
    eqResetBtn.addEventListener('click', () => {
        const current = eqPresetSelect.value;
        const actualTabId = targetTabId || activeTabId;
        const resetAction = () => {
            if (current === 'custom' || current.startsWith('custom_') || !eqPresets[current]) {
                eqPresetSelect.value = 'flat';
                applyEqPreset('flat');
                chrome.storage.sync.set({ eqPreset: 'flat' });
            } else {
                applyEqPreset(current);
            }
            if (eqPresetSelect.updateCustomSelectUI) eqPresetSelect.updateCustomSelectUI();
        };
        if (actualTabId) {
            startCaptureForTab(actualTabId).then(resetAction).catch(err => {
                console.error("Failed startCaptureForTab in eqResetBtn click listener:", err.message || err);
                resetAction();
            });
        } else {
            resetAction();
        }
    });
    async function fetchEqStateForTarget() {
        try {
            const actualTabId = targetTabId || activeTabId;
            if (actualTabId) {
                chrome.runtime.sendMessage({ type: 'get-eq-state', tabId: actualTabId }, (response) => {
                    if (response && response.success && response.bands) {
                        currentCapturedTabId = actualTabId;
                        response.bands.forEach((gain, i) => {
                            if (eqSliders[i]) {
                                eqSliders[i].setValue(gain);
                                eqCounters[i].setValue(`${gain > 0 ? '+' : ''}${parseFloat(gain).toFixed(0)}dB`, true);
                            }
                        });
                        const monoAudioToggle = document.getElementById('monoAudioToggle');
                        if (monoAudioToggle && response.isMono !== undefined) {
                            monoAudioToggle.checked = response.isMono;
                        }
                        const spatialAudioToggle = document.getElementById('spatialAudioToggle');
                        if (spatialAudioToggle && response.isSpatial !== undefined) {
                            spatialAudioToggle.checked = response.isSpatial;
                        }
                    } else {
                        if (currentCapturedTabId === actualTabId) {
                            currentCapturedTabId = null;
                        }
                    }
                });
            }
        } catch (e) {
            console.warn("Could not query eq state:", e);
        }
    }
    let volumeElasticSlider, speedElasticSlider;
    const iconVolDown = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`;
    const iconVolUp = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    const volumeValueEl = document.getElementById('volumeValue');
    volumeValueEl.innerHTML = '';
    const volSpan = document.createElement('span');
    volSpan.style.background = 'transparent';
    volSpan.style.color = 'inherit';
    volSpan.style.padding = '0';
    volSpan.style.marginLeft = '0';
    volumeValueEl.appendChild(volSpan);
    const volumeCounter = new AnimatedCounter(volSpan, { fontSize: 12 });
    volumeElasticSlider = new ElasticSlider(document.getElementById('volumeSliderContainer'), {
        min: 0,
        max: 1,
        value: 1,
        step: (val) => {
            let pct = val * 100;
            if (pct <= 12.5) {
                pct = Math.min(Math.round(pct), 10);
            } else {
                pct = Math.round(pct / 5) * 5;
            }
            return pct / 100;
        },
        leftIconSVG: iconVolDown,
        rightIconSVG: iconVolUp,
        onChange: (val) => {
            volumeCounter.setValue(Math.round(val * 100) + '%');
            debouncedApplyMediaSettings(val, 'volume');
        },
        onFormatValue: (val) => { volumeCounter.setValue(Math.round(val * 100) + '%', true); }
    });
    const iconSpeedSlow = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/></svg>`;
    const iconSpeedFast = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M14.5 7v10H13v-4.5l-4 4.5V7l4 4.5V7h1.5zm3.5 0v10h-1.5v-4.5l-4 4.5V7l4 4.5V7H18z"/></svg>`;
    const speedValueEl = document.getElementById('speedValue');
    speedValueEl.innerHTML = '';
    const speedSpan = document.createElement('span');
    speedSpan.style.background = 'transparent';
    speedSpan.style.color = 'inherit';
    speedSpan.style.padding = '0';
    speedSpan.style.marginLeft = '0';
    speedValueEl.appendChild(speedSpan);
    const speedCounter = new AnimatedCounter(speedSpan, { fontSize: 12 });
    speedElasticSlider = new ElasticSlider(document.getElementById('speedSliderContainer'), {
        min: 0.5,
        max: 5,
        value: 1,
        step: 0.1,
        leftIconSVG: iconSpeedSlow,
        rightIconSVG: iconSpeedFast,
        onChange: (val) => {
            speedCounter.setValue(val.toFixed(1) + 'x');
            debouncedApplyMediaSettings(val, 'speed');
        },
        onFormatValue: (val) => { speedCounter.setValue(val.toFixed(1) + 'x', true); }
    });
    async function fetchMediaStateForTarget() {
        try {
            let actualTabId = targetTabId;
            if (!actualTabId) {
                actualTabId = activeTabId;
                currentTargetTitle = activeTabTitle;
                isCurrentTabTarget = true;
                updateTargetTitleUI();
            }
            if (actualTabId) {
                const results = await _browser.scripting.executeScript({
                    target: { tabId: actualTabId, allFrames: true },
                    func: () => {
                        const media = document.querySelector('video, audio');
                        return media ? { volume: media.volume, speed: media.playbackRate } : null;
                    }
                });
                if (results && results.length > 0) {
                    let state = null;
                    for (const r of results) {
                        if (r.result) {
                            state = r.result;
                            break;
                        }
                    }
                    if (state) {
                        if (state.volume !== undefined) volumeElasticSlider.setValue(state.volume);
                        if (state.speed !== undefined) speedElasticSlider.setValue(state.speed);
                    } else {
                        volumeElasticSlider.setValue(1);
                        speedElasticSlider.setValue(1);
                    }
                } else {
                    volumeElasticSlider.setValue(1);
                    speedElasticSlider.setValue(1);
                }
            }
        } catch (e) {
            console.warn("Could not query media state for target tab:", e);
            volumeElasticSlider.setValue(1);
            speedElasticSlider.setValue(1);
        }
    }
    fetchMediaStateForTarget();
    fetchEqStateForTarget();
    const soundScrollList = document.getElementById('soundScrollList');
    const soundTopGradient = document.getElementById('soundTopGradient');
    const soundBottomGradient = document.getElementById('soundBottomGradient');
    if (soundScrollList) {
        function updateSoundGradients() {
            const scrollTop = soundScrollList.scrollTop;
            const scrollHeight = soundScrollList.scrollHeight;
            const clientHeight = soundScrollList.clientHeight;
            soundTopGradient.style.opacity = Math.min(scrollTop / 50, 1);
            const bottomDistance = scrollHeight - (scrollTop + clientHeight);
            soundBottomGradient.style.opacity = scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1);
        }
        soundScrollList.addEventListener('scroll', updateSoundGradients);
        setTimeout(updateSoundGradients, 50);
    }
    const tabList = document.getElementById('tabList');
    const topGradient = document.getElementById('topGradient');
    const bottomGradient = document.getElementById('bottomGradient');
    const tabsCounter1 = new AnimatedCounter(document.getElementById('tabsCounter1'));
    const tabsCounter2 = new AnimatedCounter(document.getElementById('tabsCounter2'));
    let tabs = [];
    let selectedIndex = 0;
    const customSelectContainer = document.getElementById('targetTabCustomSelect');
    const customSelectHeader = document.getElementById('targetTabSelectHeader');
    const customSelectLabel = document.getElementById('targetTabSelectLabel');
    const customSelectDropdown = document.getElementById('targetTabDropdown');
    const customSelectList = document.getElementById('targetTabDropdownList');
    let isDropdownOpen = false;
    let dropdownSelectedIndex = -1;
    let isDropdownKeyboardNav = false;
    customSelectHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(!isDropdownOpen);
    });
    document.addEventListener('click', (e) => {
        if (isDropdownOpen && !customSelectContainer.contains(e.target)) {
            toggleDropdown(false);
        }
    });
    document.addEventListener('close-all-dropdowns', (e) => {
        if (e.detail.except !== customSelectContainer) {
            toggleDropdown(false);
        }
    });
    function toggleDropdown(open) {
        if (open === isDropdownOpen) return;
        isDropdownOpen = open;
        if (isDropdownOpen) {
            document.dispatchEvent(new CustomEvent('close-all-dropdowns', { detail: { except: customSelectContainer } }));
            customSelectContainer.classList.add('open');
            customSelectDropdown.style.display = 'block';
            setTimeout(() => {
                if (dropdownSelectedIndex >= 0) {
                    scrollToDropdownItem(dropdownSelectedIndex);
                }
            }, 50);
            updateDropdownGradients();
        } else {
            customSelectContainer.classList.remove('open');
            customSelectDropdown.style.display = 'none';
        }
    }
    const dropTopGradient = document.querySelector('.dropdown-top-gradient');
    const dropBottomGradient = document.querySelector('.dropdown-bottom-gradient');
    const dropScrollContainer = customSelectDropdown.querySelector('.scroll-list');
    function updateDropdownGradients() {
        if (!dropScrollContainer) return;
        const scrollTop = dropScrollContainer.scrollTop;
        const scrollHeight = dropScrollContainer.scrollHeight;
        const clientHeight = dropScrollContainer.clientHeight;
        dropTopGradient.style.opacity = Math.min(scrollTop / 50, 1);
        const bottomDistance = scrollHeight - (scrollTop + clientHeight);
        dropBottomGradient.style.opacity = scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1);
    }
    dropScrollContainer.addEventListener('scroll', updateDropdownGradients);
    function scrollToDropdownItem(index) {
        const item = customSelectList.querySelector(`[data-dropdown-index="${index}"]`);
        if (item) {
            const extraMargin = 20;
            const containerScrollTop = dropScrollContainer.scrollTop;
            const containerHeight = dropScrollContainer.clientHeight;
            const itemTop = item.offsetTop;
            const itemBottom = itemTop + item.offsetHeight;
            if (itemTop < containerScrollTop + extraMargin) {
                dropScrollContainer.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' });
            } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
                dropScrollContainer.scrollTo({
                    top: itemBottom - containerHeight + extraMargin,
                    behavior: 'smooth'
                });
            }
        }
    }
    function updateDropdownSelectionUI() {
        const items = customSelectList.querySelectorAll('.dropdown-item');
        items.forEach((item, idx) => {
            if (idx === dropdownSelectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        if (isDropdownKeyboardNav && isDropdownOpen && dropdownSelectedIndex >= 0) {
            scrollToDropdownItem(dropdownSelectedIndex);
        }
    }
    async function handleDropdownSelect(tabId, index, title) {
        dropdownSelectedIndex = index;
        updateDropdownSelectionUI();
        if (tabId === null) {
            targetTabId = null;
            isCurrentTabTarget = true;
        } else {
            try {
                await _browser.tabs.update(tabId, { active: true });
                const tab = tabs.find(t => t.id === tabId);
                if (tab) {
                    activeTabId = tab.id;
                    activeTabTitle = tab.title;
                    activeTabUrl = tab.url || '';
                }
            } catch (err) {
                console.error("Failed to activate tab from dropdown:", err);
            }
            targetTabId = tabId;
            isCurrentTabTarget = false;
            currentTargetTitle = title;
            updateTargetTitleUI();
        }
        updateCustomSelectUI();
        updateCaptureWarning();
        fetchMediaStateForTarget();
        fetchEqStateForTarget();
        toggleDropdown(false);
    }
    function updateCustomSelectUI() {
        const currentLang = langSelect.value;
        const dict = translations[currentLang] || translations['en'];
        if (targetTabId === null) {
            customSelectLabel.setAttribute('data-i18n', 'currentTab');
            customSelectLabel.textContent = dict.currentTab;
            dropdownSelectedIndex = 0;
        } else {
            customSelectLabel.removeAttribute('data-i18n');
            const tab = tabs.find(t => t.id === targetTabId);
            if (tab) {
                customSelectLabel.textContent = tab.title;
            } else if (currentTargetTitle) {
                customSelectLabel.textContent = currentTargetTitle;
            } else {
                customSelectLabel.textContent = 'Selected Tab';
            }
            const allItems = customSelectList.querySelectorAll('.dropdown-item-wrapper');
            let found = false;
            allItems.forEach((el, index) => {
                if (parseInt(el.dataset.tabId, 10) === targetTabId) {
                    dropdownSelectedIndex = index;
                    found = true;
                }
            });
            if (!found) dropdownSelectedIndex = -1;
        }
        updateDropdownSelectionUI();
    }
    function syncTargetTabSelect() {
        customSelectList.innerHTML = '';
        const currentLang = langSelect.value;
        const dict = translations[currentLang] || translations['en'];
        let indexCnt = 0;
        const currentWrapper = document.createElement('div');
        currentWrapper.className = 'dropdown-item-wrapper';
        currentWrapper.dataset.dropdownIndex = indexCnt;
        currentWrapper.dataset.tabId = 'null';
        const currentItem = document.createElement('div');
        currentItem.className = 'dropdown-item';
        const currentSpan = document.createElement('p');
        currentSpan.className = 'dropdown-item-text';
        currentSpan.dataset.i18n = 'currentTab';
        currentSpan.textContent = dict.currentTab;
        currentItem.appendChild(currentSpan);
        currentWrapper.appendChild(currentItem);
        currentWrapper.addEventListener('mouseenter', () => {
            dropdownSelectedIndex = 0;
            isDropdownKeyboardNav = false;
            updateDropdownSelectionUI();
        });
        currentWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDropdownSelect(null, 0, dict.currentTab);
        });
        customSelectList.appendChild(currentWrapper);
        indexCnt++;
        tabs.forEach(tab => {
            const wrapper = document.createElement('div');
            wrapper.className = 'dropdown-item-wrapper';
            const curIdx = indexCnt;
            wrapper.dataset.dropdownIndex = curIdx;
            wrapper.dataset.tabId = tab.id;
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            const icon = document.createElement('img');
            icon.className = 'dropdown-item-icon';
            icon.src = tab.favIconUrl || defaultIcon;
            icon.onerror = () => { icon.src = defaultIcon; };
            const text = document.createElement('p');
            text.className = 'dropdown-item-text';
            text.textContent = tab.title;
            item.appendChild(icon);
            item.appendChild(text);
            wrapper.appendChild(item);
            wrapper.addEventListener('mouseenter', () => {
                dropdownSelectedIndex = curIdx;
                isDropdownKeyboardNav = false;
                updateDropdownSelectionUI();
            });
            wrapper.addEventListener('click', (e) => {
                e.stopPropagation();
                handleDropdownSelect(tab.id, curIdx, tab.title);
            });
            customSelectList.appendChild(wrapper);
            indexCnt++;
        });
        updateCustomSelectUI();
        setTimeout(updateDropdownGradients, 50);
    }
    const tabSearchInput = document.getElementById('tabSearchInput');
    const tabSortSelect = document.getElementById('tabSortSelect');
    if (tabSearchInput) tabSearchInput.addEventListener('input', renderTabs);
    if (tabSortSelect) tabSortSelect.addEventListener('change', renderTabs);
    function createTabItemDOM(tab, flatIndex, selectedIndex, isCollapsed) {
        const wrapper = document.createElement('div');
        wrapper.className = 'animated-item';
        wrapper.style.animationDelay = '0s';
        wrapper.dataset.index = flatIndex;
        wrapper.dataset.tabId = tab.id;
        const item = document.createElement('div');
        item.className = `item ${flatIndex === selectedIndex ? 'selected' : ''}`;
        let borderColor = 'transparent';
        if (tab.groupId && tab.groupId !== -1 && window.currentTabGroups) {
            const group = window.currentTabGroups.find(g => g.id === tab.groupId);
            if (group) {
                const colors = { grey: '#5f6368', blue: '#8ab4f8', red: '#f28b82', yellow: '#fde293', green: '#81c995', pink: '#ff8bcb', purple: '#c58af9', cyan: '#78d9ec', orange: '#fcad70' };
                borderColor = colors[group.color] || '#8ab4f8';
            }
        }
        if (borderColor !== 'transparent') item.style.borderLeft = `3px solid ${borderColor}`;
        const icon = document.createElement('img');
        icon.className = 'item-icon';
        icon.src = tab.favIconUrl || defaultIcon;
        icon.onerror = () => { icon.src = defaultIcon; };
        const text = document.createElement('p');
        text.className = 'item-text';
        text.textContent = tab.title;
        const discardBtn = document.createElement('button');
        discardBtn.className = 'mute-btn';
        discardBtn.innerHTML = '🌙';
        discardBtn.title = 'Sleep Tab';
        if (!tab.active) {
            discardBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await _browser.tabs.discard(tab.id);
                    text.style.opacity = '0.5';
                } catch (err) { }
            });
        } else {
            discardBtn.style.opacity = '0.2';
            discardBtn.style.cursor = 'default';
        }
        const muteBtn = document.createElement('button');
        muteBtn.className = 'mute-btn';
        let isMuted = tab.mutedInfo && tab.mutedInfo.muted;
        const iconVolume = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="var(--primary-color)" viewBox="0 0 16 16"><path d="M11.536 14.01A8.47 8.47 0 0 0 14.026 8a8.47 8.47 0 0 0-2.49-6.01l-.708.707A7.48 7.48 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/><path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.48 5.48 0 0 1 11.025 8a5.48 5.48 0 0 1-1.61 3.89l.706.706z"/><path d="M8.707 11.182A4.5 4.5 0 0 0 10.025 8a4.5 4.5 0 0 0-1.318-3.182L8 5.525A3.5 3.5 0 0 1 9.025 8 3.5 3.5 0 0 1 8 10.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/></svg>`;
        const iconMuted = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="var(--primary-color)" viewBox="0 0 16 16"><path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zm7.137 2.096a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z"/></svg>`;
        muteBtn.innerHTML = isMuted ? iconMuted : iconVolume;
        muteBtn.title = isMuted ? 'Unmute' : 'Mute';
        muteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const newMutedState = !isMuted;
                await _browser.tabs.update(tab.id, { muted: newMutedState });
                isMuted = newMutedState;
                tab.mutedInfo = { muted: newMutedState };
                muteBtn.innerHTML = isMuted ? iconMuted : iconVolume;
                muteBtn.title = isMuted ? 'Unmute' : 'Mute';
            } catch (err) { }
        });
        const mixerBtn = document.createElement('button');
        mixerBtn.className = 'mixer-btn';
        mixerBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="var(--primary-color)" viewBox="0 0 16 16"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/><path d="M4.5 4a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 1 0v-7a.5.5 0 0 0-.5-.5zm3 0a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 1 0v-7a.5.5 0 0 0-.5-.5zm3 0a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 1 0v-7a.5.5 0 0 0-.5-.5z"/><path d="M4.5 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>';
        const currentLang = langSelect.value;
        const dict = translations[currentLang] || translations['en'];
        mixerBtn.title = dict.soundControl || 'Sound Control';
        mixerBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await _browser.tabs.update(tab.id, { active: true });
                activeTabId = tab.id;
                activeTabTitle = tab.title;
                activeTabUrl = tab.url || '';
            } catch (err) {
                console.error("Failed to activate tab:", err);
            }
            targetTabId = tab.id;
            currentTargetTitle = tab.title;
            isCurrentTabTarget = false;
            updateTargetTitleUI();
            updateCaptureWarning();
            switchView('tabSound', 'soundView');
            fetchMediaStateForTarget();
            fetchEqStateForTarget();
        });
        item.appendChild(icon);
        item.appendChild(text);
        item.appendChild(discardBtn);
        item.appendChild(muteBtn);
        item.appendChild(mixerBtn);
        wrapper.appendChild(item);
        wrapper.addEventListener('mouseenter', () => { selectedIndex = flatIndex; updateSelection(false); });
        wrapper.addEventListener('click', (e) => { if (e.button === 0) selectTabByLogicalIndex(flatIndex); });
        wrapper.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
        wrapper.addEventListener('mouseup', async (e) => {
            if (e.button === 1) {
                e.preventDefault(); e.stopPropagation();
                try {
                    await _browser.tabs.remove(tab.id);
                    wrapper.style.opacity = '0'; wrapper.style.transform = 'scale(0.8)';
                    wrapper.style.transition = 'opacity 0.2s, transform 0.2s';
                    setTimeout(async () => {
                        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                        await initTabs();
                    }, 200);
                } catch (err) { }
            }
        });
        return wrapper;
    }
    async function initTabs() {
        try {
            const storage = await _browser.storage.local.get('collapsedDomains');
            if (storage.collapsedDomains) {
                collapsedDomains = new Set(storage.collapsedDomains);
            }
            tabs = await _browser.tabs.query({ currentWindow: true });
            const activeTabs = await _browser.tabs.query({ active: true, currentWindow: true });
            if (activeTabs.length > 0) {
                activeTabId = activeTabs[0].id;
                activeTabTitle = activeTabs[0].title;
                activeTabUrl = activeTabs[0].url || '';
            }
            window.currentTabGroups = [];
            if (_browser.tabGroups) {
                try {
                    window.currentTabGroups = await _browser.tabGroups.query({ windowId: _browser.windows.WINDOW_ID_CURRENT });
                } catch (e) { }
            }
            syncTargetTabSelect();
            renderTabs();
            updateCaptureWarning();
        } catch (e) {
            console.error('Error fetching tabs:', e);
            return;
        }
    }
    initTabs();
    const newTabWrapper = document.getElementById('newTabBtnWrapper');
    if (newTabWrapper) {
        newTabWrapper.addEventListener('mouseenter', () => {
            selectedIndex = 0;
            updateSelection(false);
        });
        newTabWrapper.addEventListener('click', (e) => {
            if (e.button === 0) {
                selectTabByLogicalIndex(0);
            }
        });
    }
    function selectTabByLogicalIndex(logicalIndex) {
        if (logicalIndex === 0) {
            _browser.tabs.create({});
            window.close();
            return;
        }
        const wrapper = tabList.querySelector(`.animated-item[data-index="${logicalIndex}"]`);
        if (wrapper && wrapper.dataset.tabId) {
            const tabId = parseInt(wrapper.dataset.tabId);
            _browser.tabs.update(tabId, { active: true });
            window.close();
        }
    }
    function updateGradients() {
        const scrollTop = tabList.scrollTop;
        const scrollHeight = tabList.scrollHeight;
        const clientHeight = tabList.clientHeight;
        topGradient.style.opacity = Math.min(scrollTop / 50, 1);
        const bottomDistance = scrollHeight - (scrollTop + clientHeight);
        bottomGradient.style.opacity = scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1);
    }
    tabList.addEventListener('scroll', updateGradients);
    window.addEventListener('keydown', (e) => {
        if (isDropdownOpen) {
            const totalDropdownItems = customSelectList.querySelectorAll('.dropdown-item-wrapper').length;
            if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
                e.preventDefault();
                isDropdownKeyboardNav = true;
                dropdownSelectedIndex = Math.min(dropdownSelectedIndex + 1, totalDropdownItems - 1);
                updateDropdownSelectionUI();
            } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
                e.preventDefault();
                isDropdownKeyboardNav = true;
                dropdownSelectedIndex = Math.max(dropdownSelectedIndex - 1, 0);
                updateDropdownSelectionUI();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (dropdownSelectedIndex >= 0) {
                    const item = customSelectList.querySelector(`[data-dropdown-index="${dropdownSelectedIndex}"]`);
                    if (item) {
                        const tId = item.dataset.tabId;
                        const title = item.querySelector('.dropdown-item-text').textContent;
                        handleDropdownSelect(tId === 'null' ? null : parseInt(tId, 10), dropdownSelectedIndex, title);
                    }
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                toggleDropdown(false);
            }
            return;
        }
        if (!tabsView.classList.contains('active')) return;
        const visIdxs = window._visibleFlatIndices || [];
        if (visIdxs.length === 0) return;
        let currentVisPos = visIdxs.indexOf(selectedIndex);
        if (currentVisPos === -1) currentVisPos = 0;
        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault();
            const nextPos = Math.min(currentVisPos + 1, visIdxs.length - 1);
            selectedIndex = visIdxs[nextPos];
            updateSelection(true);
        } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
            e.preventDefault();
            const prevPos = Math.max(currentVisPos - 1, 0);
            selectedIndex = visIdxs[prevPos];
            updateSelection(true);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            selectTabByLogicalIndex(selectedIndex);
        }
    });
    function updateSelection(scrollIntoView) {
        const newTabBtn = document.querySelector('#newTabBtnWrapper .item');
        if (newTabBtn) {
            if (selectedIndex === 0) {
                newTabBtn.classList.add('selected');
            } else {
                newTabBtn.classList.remove('selected');
            }
        }
        const items = tabList.querySelectorAll('.item');
        items.forEach((item, idx) => {
            const itemLogicalIndex = idx + 1;
            if (itemLogicalIndex === selectedIndex) {
                item.classList.add('selected');
                if (scrollIntoView) {
                    const wrapper = item.parentElement;
                    const extraMargin = 40;
                    const containerScrollTop = tabList.scrollTop;
                    const containerHeight = tabList.clientHeight;
                    const itemTop = wrapper.offsetTop;
                    const itemBottom = itemTop + wrapper.offsetHeight;
                    if (itemTop < containerScrollTop + extraMargin) {
                        tabList.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' });
                    } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
                        tabList.scrollTo({
                            top: itemBottom - containerHeight + extraMargin,
                            behavior: 'smooth'
                        });
                    }
                }
            } else {
                item.classList.remove('selected');
            }
        });
    }
    const defaultIcon = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%23aaaaaa" viewBox="0 0 16 16"><path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2-2H4a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4z"/></svg>';
    function getDomain(urlStr) {
        if (!urlStr) return "Other";
        try {
            const url = new URL(urlStr);
            if (url.protocol.startsWith('chrome-extension:')) {
                return "Extensions";
            }
            if (url.protocol.startsWith('chrome:') || url.protocol.startsWith('about:')) {
                return "Browser Settings";
            }
            if (url.protocol === 'file:') return "Local Files";
            let hostname = url.hostname;
            if (hostname.startsWith('www.')) {
                hostname = hostname.substring(4);
            }
            return hostname || "Other";
        } catch (e) {
            return "Other";
        }
    }
    let collapsedDomains = new Set();
    function renderTabs() {
        tabList.innerHTML = '';
        const query = tabSearchInput ? tabSearchInput.value.toLowerCase() : '';
        let filteredTabs = tabs.filter(t => t.title.toLowerCase().includes(query) || (t.url && t.url.toLowerCase().includes(query)));
        tabsCounter1.setValue(filteredTabs.length);
        tabsCounter2.setValue(filteredTabs.length);
        let flatIndex = 1;
        let visibleFlatIndices = [0];
        const sortMode = tabSortSelect ? tabSortSelect.value : 'domain';
        const fragment = document.createDocumentFragment();
        if (sortMode === 'alpha' || sortMode === 'default') {
            let list = [...filteredTabs];
            if (sortMode === 'alpha') {
                list.sort((a, b) => a.title.localeCompare(b.title));
            }
            list.forEach(tab => {
                const wrapper = createTabItemDOM(tab, flatIndex, selectedIndex, false);
                visibleFlatIndices.push(flatIndex);
                fragment.appendChild(wrapper);
                flatIndex++;
            });
        } else {
            const groups = {};
            filteredTabs.forEach(tab => {
                const domain = getDomain(tab.url);
                if (!groups[domain]) groups[domain] = [];
                groups[domain].push(tab);
            });
            for (const [domain, domainTabs] of Object.entries(groups)) {
                const isCollapsed = collapsedDomains.has(domain);
                const header = document.createElement('div');
                header.className = 'domain-header';
                header.style.color = 'var(--text-secondary)';
                header.style.fontSize = '12px';
                header.style.fontWeight = 'bold';
                header.style.textTransform = 'uppercase';
                header.style.letterSpacing = '0.5px';
                header.style.padding = '15px 15px 5px 15px';
                header.style.marginTop = '5px';
                header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
                header.style.marginBottom = isCollapsed ? '15px' : '5px';
                header.style.display = 'flex';
                header.style.alignItems = 'center';
                header.style.cursor = 'pointer';
                header.style.userSelect = 'none';
                const domainIcon = document.createElement('img');
                domainIcon.src = domainTabs[0].favIconUrl || defaultIcon;
                domainIcon.onerror = () => { domainIcon.src = defaultIcon; };
                domainIcon.style.width = '14px';
                domainIcon.style.height = '14px';
                domainIcon.style.marginRight = '8px';
                domainIcon.style.borderRadius = '3px';
                domainIcon.style.opacity = '0.8';
                const headerText = document.createElement('span');
                headerText.textContent = domain;
                headerText.style.flex = '1';
                const chevronOuter = document.createElement('div');
                chevronOuter.style.display = 'flex';
                chevronOuter.style.alignItems = 'center';
                chevronOuter.style.transition = 'transform 0.2s';
                chevronOuter.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
                chevronOuter.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>`;
                header.appendChild(domainIcon);
                header.appendChild(headerText);
                header.appendChild(chevronOuter);
                fragment.appendChild(header);
                const groupContainer = document.createElement('div');
                groupContainer.className = 'domain-group-container';
                groupContainer.style.display = isCollapsed ? 'none' : 'block';
                fragment.appendChild(groupContainer);
                header.addEventListener('click', () => {
                    const isNowCollapsed = !collapsedDomains.has(domain);
                    if (isNowCollapsed) {
                        collapsedDomains.add(domain);
                        groupContainer.style.display = 'none';
                        chevronOuter.style.transform = 'rotate(-90deg)';
                        header.style.marginBottom = '15px';
                        let isSelectedInGroup = false;
                        domainTabs.forEach(t => {
                            const childW = groupContainer.querySelector(`[data-tab-id="${t.id}"]`);
                            if (childW && parseInt(childW.dataset.index, 10) === selectedIndex) isSelectedInGroup = true;
                        });
                        if (isSelectedInGroup) selectedIndex = 0;
                    } else {
                        collapsedDomains.delete(domain);
                        groupContainer.style.display = 'block';
                        chevronOuter.style.transform = 'rotate(0deg)';
                        header.style.marginBottom = '5px';
                    }
                    _browser.storage.local.set({ collapsedDomains: Array.from(collapsedDomains) });
                    updateVisibleIndicesDynamic();
                });
                domainTabs.forEach((tab) => {
                    const wrapper = createTabItemDOM(tab, flatIndex, selectedIndex, isCollapsed);
                    if (!isCollapsed) visibleFlatIndices.push(flatIndex);
                    groupContainer.appendChild(wrapper);
                    flatIndex++;
                });
            }
        }
        tabList.appendChild(fragment);
        window._visibleFlatIndices = visibleFlatIndices;
        if (visibleFlatIndices.length > 0 && !visibleFlatIndices.includes(selectedIndex)) {
            selectedIndex = visibleFlatIndices.reduce((prev, curr) => Math.abs(curr - selectedIndex) < Math.abs(prev - selectedIndex) ? curr : prev, visibleFlatIndices[0]);
            updateSelection(false);
        }
        setTimeout(updateGradients, 50);
    }
    function updateVisibleIndicesDynamic() {
        const newVisible = [0];
        const wrappers = tabList.querySelectorAll('.animated-item');
        wrappers.forEach(w => {
            const group = w.closest('.domain-group-container');
            if (group && group.style.display !== 'none') {
                newVisible.push(parseInt(w.dataset.index, 10));
            }
        });
        window._visibleFlatIndices = newVisible;
        if (newVisible.length > 0 && !newVisible.includes(selectedIndex)) {
            selectedIndex = newVisible.reduce((prev, curr) => Math.abs(curr - selectedIndex) < Math.abs(prev - selectedIndex) ? curr : prev, newVisible[0]);
            updateSelection(false);
        }
    }
});
