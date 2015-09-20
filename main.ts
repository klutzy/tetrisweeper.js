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

    tick: number;
    // whether the board has been changed
    // to reduce work of compute_neighbors()
    board_changed: boolean;

    constructor(canvas: HTMLCanvasElement, tile_img: HTMLImageElement,
            width: number, height: number, num_max_mines: number) {
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

        this.board = [];
        this.neighbors = [];
        for (var i: number = 0; i < this.height; i++) {
            var line = [];
            var neighbor_line = [];
            for (var j: number = 0; j < this.width; j++) {
                var tile = new Tile(true, false, 0);

                if (i >= this.height - 4) {
                    if (Math.random() < 0.8) {
                        tile.empty = false;
                        tile.opened = false;
                        if (Math.random() < 0.2) {
                            tile.opened = true;
                        }

                        tile.num_mines = 0;
                        if (Math.random() < 0.5) {
                            tile.num_mines = 1;
                        }
                    }
                }

                line.push(tile);
                neighbor_line.push(0);
            }
            this.board.push(line);
            this.neighbors.push(neighbor_line);
        }

        this.canvas.addEventListener('click', (e) => {this.onClick(e, false); return false;});
        this.canvas.addEventListener('contextmenu', (e) => {this.onClick(e, true); return false});
    }

    start() {
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

    render() {
        for (var i: number = 0; i < this.height; i++) {
            for (var j: number = 0; j < this.width; j++) {
                var x = 0;
                var y = 0;
                var t =  this.board[i][j];
                if (t.dead) {
                    x = 0;
                    y = 0;
                }
                else if (t.empty) {
                    x = 7; y = 0;
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
    }

    onTick() {
        this.compute_neighbors();

        if (this.tick % 20 == 0) {
            // TODO move tetris block
            this.tick = 0;
        }

        this.tick += 1;
    }

    onClick(event: MouseEvent, is_context: boolean) {
        event.preventDefault();

        var x = Math.floor(event.clientX / this.tile_width - .5);
        var y = Math.floor(event.clientY / this.tile_height - .5);
        console.log([event, is_context, this.width, this.height, x, y]);
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

        return;
    }
}
