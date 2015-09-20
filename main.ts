class Tile {
    // the tile has no block
    empty: boolean;
    // block has been opened
    opened: boolean;
    num_mines: number;
    dead: boolean;
    flags: number;

    constructor(empty: boolean, opened: boolean, num_mines: number) {
        this.empty = empty;
        this.opened = opened;
        this.num_mines = num_mines;
        this.dead = false;
        this.flags = 0;
    }
}

enum Tetromino {
    I, J, L, O, S, T, Z,
}

// following SRS rule
// http://tetris.wikia.com/wiki/SRS
function tetronimo_tiles(ty: Tetromino) {
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

function rotate_tetromino(tet: number[][], rot: number) {
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

class Tetrisweeper {
    width: number;
    height: number;
    tile_width: number;
    tile_height: number;
    num_max_mines: number;
    // not including falling tetris piece
    board: Tile[][];
    // the number of neighbors with mine
    neighbors: number[][];

    tile_img: HTMLImageElement;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;

    running: boolean;

    tetris_x: number;
    tetris_y: number;
    tetris_tet: number[][];
    tetris_type: Tetromino;
    tetris_rotation: number;

    tick: number;
    tetris_ticks: number;

    // keyboard keycode for current tick. 0 if none.
    keycode: number;

    // whether the board has been changed
    // to reduce work of compute_neighbors()
    board_changed: boolean;

    init_empty_prob: number;
    init_opened_prob: number;
    init_mine_prob: number;

    // for scoring?
    num_mines : number;
    num_lines_clear: number;
    num_mines_clear: number;

    constructor(canvas: HTMLCanvasElement, tile_img: HTMLImageElement,
            width: number, height: number, num_max_mines: number) {
        // extra parameters
        this.tetris_ticks = 30;
        this.init_empty_prob = 0.2;
        this.init_opened_prob = 0.2;
        this.init_mine_prob = 0.2;

        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.tile_img = tile_img;

        this.tile_width = 16;
        this.tile_height = 16;

        this.width = width;
        this.height = height;
        this.num_max_mines = num_max_mines;
        this.running = false;
        this.tick = 0;
        this.board_changed = true;

        this.keycode = 0;

        this.board = [];
        this.neighbors = [];

        this.canvas.addEventListener('click', (e) => {this.onClick(e, false); return false;});
        this.canvas.addEventListener('contextmenu', (e) => {this.onClick(e, true); return false});
        document.addEventListener('keydown', (e) => {this.onKeyDown(e); return false});
    }

    init() {
        this.num_mines = 0;
        this.num_lines_clear = 0;
        this.num_mines_clear = 0;
        this.tick = 0;
        this.new_tetromino();

        for (var i: number = 0; i < this.height; i++) {
            var line = [];
            var neighbor_line = [];
            for (var j: number = 0; j < this.width; j++) {
                var tile = new Tile(true, false, 0);
                if (i >= this.height - 4) {
                    tile = this.new_random_tile(true);
                }
                this.num_mines += tile.num_mines;
                line.push(tile);
                neighbor_line.push(0);
            }
            this.board.push(line);
            this.neighbors.push(neighbor_line);
        }
    }

    new_random_tile(allow_empty: boolean) {
        var tile = new Tile(true, false, 0);

        if (!allow_empty || Math.random() > this.init_empty_prob) {
            tile.empty = false;
            tile.opened = false;
            if (Math.random() < this.init_opened_prob) {
                tile.opened = true;
            }

            tile.num_mines = 0;
            if (!tile.opened && Math.random() < this.init_mine_prob) {
                tile.num_mines = 1;
            }
        }

        return tile;
    }

    new_tetromino() {
        this.tetris_x = Math.floor(this.width / 2) - 1;
        this.tetris_y = 0;
        var ty = Math.floor(Math.random() * 7);
        var rot = Math.floor(Math.random() * 4);
        var tet = tetronimo_tiles(ty);
        tet = rotate_tetromino(tet, rot);
        this.tetris_tet = tet;
    }

    start() {
        this.init();

        this.running = true;
        this.tick_step();
    }

    tick_step() {
        this.onTick();
        this.render();
        if (this.running) {
            window.requestAnimationFrame(() => this.tick_step());
        }
    }

    compute_neighbors() {
        if (!this.board_changed) {
            return;
        }

        for (var i: number = 0; i < this.height; i++) {
            for (var j: number = 0; j < this.width; j++) {
                this.neighbors[i][j] = 0;
            }
        }

        for (var i: number = 0; i < this.height; i++) {
            for (var j: number = 0; j < this.width; j++) {
                var b = this.board[i][j];
                if (b.empty || b.num_mines == 0) {
                    continue;
                }

                for (var u: number = i - 1; u < i + 2; u++) {
                    for (var v: number = j - 1; v < j + 2; v++) {
                        if (u < 0 || v < 0 || u >= this.height || v >= this.width) {
                            continue;
                        }
                        this.neighbors[u][v] += b.num_mines;
                    }
                }
            }
        }

        this.board_changed = false;
    }

    // return true if input is valid under current tiles.
    check_tetromino(x: number, y: number, tet: number[][]) {
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
    }

    remove_complete_lines() {
        var num_cleared = 0;
        var new_board = [];

        for (var i: number = 0; i < this.height; i++) {
            var cleared = true;
            var num_mines_line = 0;
            for (var j: number = 0; j < this.width; j++) {
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
            } else {
                new_board.push(this.board[i]);
            }
        }

        for (var i: number = 0; i < num_cleared; i++) {
            var empty_line = [];
            for (var j: number = 0; j < this.width; j++) {
                var tile = new Tile(true, false, 0);
                empty_line.push(tile);
            }
            new_board.unshift(empty_line);
        }
        this.board = new_board;

        if (num_cleared > 0) {
            this.board_changed = true;
        }
    }

    render() {
        this.compute_neighbors();

        for (var i: number = 0; i < this.height; i++) {
            for (var j: number = 0; j < this.width; j++) {
                var x = 0;
                var y = 0;
                var t =  this.board[i][j];

                if (t.empty) {
                    this.context.clearRect(this.tile_width * j, this.tile_height * i,
                            this.tile_width, this.tile_height);
                    continue;
                }

                if (t.dead) {
                    x = 0;
                    y = 0;
                }
                else if (t.flags > 0) {
                    x = 1; y = t.flags;
                }
                else if (!t.opened) {
                    x = 0; y = 1;
                }
                else if (t.num_mines > 0) {
                    x = t.num_mines;
                    y = 0;
                } else {
                    // TODO handle neighbors > 10
                    x = this.neighbors[i][j];
                    y = 2;
                }
                this.context.drawImage(this.tile_img,
                        this.tile_width * x, this.tile_height * y,
                        this.tile_width, this.tile_height,
                        this.tile_width * j, this.tile_height * i,
                        this.tile_width, this.tile_height);
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
                this.context.drawImage(this.tile_img,
                        this.tile_width * 9, this.tile_height * 1,
                        this.tile_width, this.tile_height,
                        this.tile_width * x, this.tile_height * y,
                        this.tile_width, this.tile_height);
            }
        }
    }

    onTick() {
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
                    }
                }
                this.board_changed = true;
                this.remove_complete_lines();

                this.new_tetromino();
            } else {
                this.tetris_y += 1;
            }
            this.tick = 0;
        }

        this.tick += 1;
    }

    onClick(event: MouseEvent, is_context: boolean) {
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
            } else {
                t.opened = true;
            }
        } else {
            t.flags += 1;
            if (t.flags > this.num_max_mines) {
                t.flags = 0;
            }
        }

        this.remove_complete_lines();

        return;
    }

    onKeyDown(event: KeyboardEvent) {
        this.keycode = event.keyCode;
    }
}
