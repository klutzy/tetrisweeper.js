var Tile = (function () {
    function Tile(empty, opened, num_mines) {
        this.empty = empty;
        this.opened = opened;
        this.num_mines = num_mines;
        this.dead = false;
        this.flags = 0;
    }
    return Tile;
})();
var Tetromino;
(function (Tetromino) {
    Tetromino[Tetromino["I"] = 0] = "I";
    Tetromino[Tetromino["J"] = 1] = "J";
    Tetromino[Tetromino["L"] = 2] = "L";
    Tetromino[Tetromino["O"] = 3] = "O";
    Tetromino[Tetromino["S"] = 4] = "S";
    Tetromino[Tetromino["T"] = 5] = "T";
    Tetromino[Tetromino["Z"] = 6] = "Z";
})(Tetromino || (Tetromino = {}));
// following SRS rule
// http://tetris.wikia.com/wiki/SRS
function tetronimo_tiles(ty) {
    var tets = [
        // I
        [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
        ],
        // J
        [
            [1, 0, 0],
            [1, 1, 1],
            [0, 0, 0],
        ],
        // L
        [
            [0, 0, 1],
            [1, 1, 1],
            [0, 0, 0],
        ],
        // O
        [
            [1, 1],
            [1, 1],
        ],
        // S
        [
            [0, 1, 1],
            [1, 1, 0],
            [0, 0, 0],
        ],
        // T
        [
            [0, 1, 0],
            [1, 1, 1],
            [0, 0, 0],
        ],
        // Z
        [
            [1, 1, 0],
            [0, 1, 1],
            [0, 0, 0],
        ],
    ];
    return tets[ty];
}
function rotate_tetromino(tet, rot) {
    while (rot > 0) {
        var tet2 = [];
        for (var i = 0; i < tet.length; i++) {
            tet2.push(tet[i].slice());
        }
        for (var i = 0; i < tet.length; i++) {
            for (var j = 0; j < tet.length; j++) {
                tet2[tet.length - j - 1][i] = tet[i][j];
            }
        }
        tet = tet2;
        rot -= 1;
    }
    return tet;
}
var Tetrisweeper = (function () {
    function Tetrisweeper(canvas, tile_img, width, height, num_max_mines, on_tick) {
        var _this = this;
        // extra parameters
        this.init_tetris_ticks = 30;
        this.init_empty_prob = 0.1;
        this.init_opened_prob = 0.2;
        this.init_mine_prob = 0.3;
        this.init_lines = 5;
        this.opened_prob = 0.0;
        this.mine_prob = 0.2;
        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.tile_img = tile_img;
        this.tile_width = 16;
        this.tile_height = 16;
        this.width = width;
        this.height = height;
        this.num_max_mines = num_max_mines;
        this.on_tick = on_tick;
        this.running = false;
        this.tick = 0;
        this.board_changed = true;
        this.keycode = 0;
        this.board = [];
        this.neighbors = [];
        this.canvas.addEventListener('click', function (e) { _this.onClick(e, false); return false; });
        this.canvas.addEventListener('contextmenu', function (e) { _this.onClick(e, true); return false; });
        document.addEventListener('keydown', function (e) { _this.onKeyDown(e); return false; });
    }
    Tetrisweeper.prototype.init = function () {
        this.tetris_ticks = this.init_tetris_ticks;
        this.num_mines = 0;
        this.num_lines_clear = 0;
        this.num_mines_clear = 0;
        this.tick = 0;
        this.new_tetromino();
        this.board = [];
        this.neighbors = [];
        this.board_changed = true;
        for (var i = 0; i < this.height; i++) {
            var line = [];
            var neighbor_line = [];
            for (var j = 0; j < this.width; j++) {
                var tile = new Tile(true, false, 0);
                if (i >= this.height - this.init_lines) {
                    tile = this.new_random_tile(true);
                }
                this.num_mines += tile.num_mines;
                line.push(tile);
                neighbor_line.push(0);
            }
            this.board.push(line);
            this.neighbors.push(neighbor_line);
        }
        this.compute_neighbors();
    };
    Tetrisweeper.prototype.new_random_tile = function (init) {
        var tile = new Tile(true, false, 0);
        var empty_prob = this.init_empty_prob;
        var mine_prob = this.init_mine_prob;
        var opened_prob = this.init_opened_prob;
        if (!init) {
            empty_prob = 0;
            mine_prob = this.mine_prob;
            opened_prob = this.opened_prob;
        }
        if (Math.random() > empty_prob) {
            tile.empty = false;
            tile.opened = false;
            if (Math.random() < opened_prob) {
                tile.opened = true;
            }
            tile.num_mines = 0;
            if (!tile.opened && Math.random() < mine_prob) {
                tile.num_mines = 1;
            }
        }
        return tile;
    };
    Tetrisweeper.prototype.new_tetromino = function () {
        this.tetris_x = Math.floor(this.width / 2) - 1;
        this.tetris_y = 0;
        var ty = Math.floor(Math.random() * 7);
        var rot = Math.floor(Math.random() * 4);
        var tet = tetronimo_tiles(ty);
        tet = rotate_tetromino(tet, rot);
        this.tetris_tet = tet;
    };
    Tetrisweeper.prototype.start = function () {
        if (!this.running) {
            this.init();
            this.running = true;
            this.onTick();
        }
        else {
            this.init();
        }
    };
    Tetrisweeper.prototype.onTick = function () {
        var _this = this;
        this.tick_game();
        this.render();
        this.on_tick(this);
        if (this.running) {
            window.requestAnimationFrame(function () { return _this.onTick(); });
        }
    };
    Tetrisweeper.prototype.compute_neighbors = function () {
        if (!this.board_changed) {
            return;
        }
        for (var i = 0; i < this.height; i++) {
            for (var j = 0; j < this.width; j++) {
                this.neighbors[i][j] = 0;
            }
        }
        for (var i = 0; i < this.height; i++) {
            for (var j = 0; j < this.width; j++) {
                var b = this.board[i][j];
                if (b.empty || b.num_mines == 0) {
                    continue;
                }
                for (var u = i - 1; u < i + 2; u++) {
                    for (var v = j - 1; v < j + 2; v++) {
                        if (u < 0 || v < 0 || u >= this.height || v >= this.width) {
                            continue;
                        }
                        this.neighbors[u][v] += b.num_mines;
                    }
                }
            }
        }
        this.board_changed = false;
    };
    // return true if input is valid under current tiles.
    Tetrisweeper.prototype.check_tetromino = function (x, y, tet) {
        for (var i = 0; i < tet.length; i++) {
            for (var j = 0; j < tet.length; j++) {
                if (tet[i][j] == 0) {
                    continue;
                }
                var p = x + i;
                var q = y + j;
                if (p < 0 || p >= this.width || q >= this.height) {
                    return false;
                }
                if (!this.board[q][p].empty) {
                    return false;
                }
            }
        }
        return true;
    };
    Tetrisweeper.prototype.remove_complete_lines = function () {
        var num_cleared = 0;
        var new_board = [];
        for (var i = 0; i < this.height; i++) {
            var cleared = true;
            var num_mines_line = 0;
            for (var j = 0; j < this.width; j++) {
                var t = this.board[i][j];
                num_mines_line += t.num_mines;
                if (t.num_mines == 0 && !t.opened) {
                    cleared = false;
                    break;
                }
            }
            if (cleared) {
                num_cleared += 1;
                this.num_lines_clear += 1;
                this.num_mines_clear += num_mines_line;
                this.num_mines -= num_mines_line;
            }
            else {
                new_board.push(this.board[i]);
            }
        }
        for (var i = 0; i < num_cleared; i++) {
            var empty_line = [];
            for (var j = 0; j < this.width; j++) {
                var tile = new Tile(true, false, 0);
                empty_line.push(tile);
            }
            new_board.unshift(empty_line);
        }
        this.board = new_board;
        if (num_cleared > 0) {
            this.board_changed = true;
        }
    };
    Tetrisweeper.prototype.render = function () {
        for (var i = 0; i < this.height; i++) {
            for (var j = 0; j < this.width; j++) {
                var x = 0;
                var y = 0;
                var t = this.board[i][j];
                if (t.empty) {
                    this.context.clearRect(this.tile_width * j, this.tile_height * i, this.tile_width, this.tile_height);
                    continue;
                }
                if (t.dead) {
                    x = 5;
                    y = 0;
                }
                else if (this.running && t.flags > 0) {
                    x = 1;
                    y = t.flags;
                }
                else if (this.running && !t.opened) {
                    x = 0;
                    y = 1;
                }
                else if (t.num_mines > 0) {
                    x = t.num_mines;
                    y = 0;
                }
                else {
                    // TODO handle neighbors > 10
                    x = this.neighbors[i][j];
                    y = 2;
                }
                this.context.drawImage(this.tile_img, this.tile_width * x, this.tile_height * y, this.tile_width, this.tile_height, this.tile_width * j, this.tile_height * i, this.tile_width, this.tile_height);
            }
        }
        var tet = this.tetris_tet;
        for (var i = 0; i < tet.length; i++) {
            for (var j = 0; j < tet.length; j++) {
                if (tet[i][j] == 0) {
                    continue;
                }
                var x = this.tetris_x + i;
                var y = this.tetris_y + j;
                if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
                    continue;
                }
                this.context.drawImage(this.tile_img, this.tile_width * 9, this.tile_height * 1, this.tile_width, this.tile_height, this.tile_width * x, this.tile_height * y, this.tile_width, this.tile_height);
            }
        }
    };
    Tetrisweeper.prototype.tick_game = function () {
        var num_lines_clear = this.num_lines_clear;
        if (this.keycode != 0) {
            var new_x = this.tetris_x;
            var new_y = this.tetris_y;
            var new_tet = this.tetris_tet;
            if (this.keycode == 37) {
                new_x -= 1;
            }
            if (this.keycode == 38) {
                new_tet = rotate_tetromino(this.tetris_tet, 1);
            }
            if (this.keycode == 39) {
                new_x += 1;
            }
            if (this.keycode == 40) {
                new_y += 1;
            }
            var ok = this.check_tetromino(new_x, new_y, new_tet);
            if (ok) {
                this.tetris_x = new_x;
                this.tetris_y = new_y;
                this.tetris_tet = new_tet;
            }
            this.keycode = 0;
        }
        if (this.tick % this.tetris_ticks == 0) {
            var ok = this.check_tetromino(this.tetris_x, this.tetris_y + 1, this.tetris_tet);
            if (!ok) {
                // add new blocks
                var tet = this.tetris_tet;
                for (var i = 0; i < tet.length; i++) {
                    for (var j = 0; j < tet.length; j++) {
                        if (tet[i][j] == 0) {
                            continue;
                        }
                        var x = this.tetris_x + i;
                        var y = this.tetris_y + j;
                        this.board[y][x] = this.new_random_tile(false);
                        this.num_mines += this.board[y][x].num_mines;
                    }
                }
                this.board_changed = true;
                this.remove_complete_lines();
                this.new_tetromino();
                // too many tetrominos
                var ok = this.check_tetromino(this.tetris_x, this.tetris_y, this.tetris_tet);
                if (!ok) {
                    this.running = false;
                }
            }
            else {
                this.tetris_y += 1;
            }
            this.tick = 0;
        }
        this.compute_neighbors();
        // speed adjustment
        var lines_before = Math.floor(num_lines_clear / 10);
        var lines_after = Math.floor(this.num_lines_clear / 10);
        if (lines_before < lines_after && this.tetris_ticks > 10) {
            this.tetris_ticks -= 1;
        }
        this.tick += 1;
    };
    Tetrisweeper.prototype.onClick = function (event, is_context) {
        event.preventDefault();
        var x = Math.floor(event.clientX / this.tile_width - .5);
        var y = Math.floor(event.clientY / this.tile_height - .5);
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return;
        }
        var t = this.board[y][x];
        if (t.empty || t.opened) {
            return;
        }
        if (!is_context) {
            if (t.flags > 0) {
                return;
            }
            if (t.num_mines > 0) {
                // BAM!!
                t.dead = true;
                this.running = false;
            }
            else {
                t.opened = true;
            }
        }
        else {
            t.flags += 1;
            if (t.flags > this.num_max_mines) {
                t.flags = 0;
            }
        }
        this.remove_complete_lines();
        return;
    };
    Tetrisweeper.prototype.onKeyDown = function (event) {
        this.keycode = event.keyCode;
    };
    return Tetrisweeper;
})();
