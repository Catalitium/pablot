import pygame
import random
import json

# Constants
SCREEN_WIDTH, SCREEN_HEIGHT = 800, 600
GRID_COLOR = (200, 200, 200)
CELL_COLOR = (0, 255, 0)
DEAD_COLOR = (0, 0, 0)
STATS_COLOR = (255, 255, 255)
FPS = 30

# Grid settings
GRID_SIZE = 50
CELL_SIZE = SCREEN_WIDTH // GRID_SIZE

# Initialize Pygame
pygame.init()
screen = pygame.display.set_mode((SCREEN_WIDTH + 300, SCREEN_HEIGHT))  # Extra space for stats
pygame.display.set_caption("LifeSim: Conway's Game of Life Simulator")
clock = pygame.time.Clock()

# Initialize grid
grid = [[0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
generation = 0
population_history = []

# Predefined patterns
PATTERNS = {
    "Glider": [(1, 0), (2, 1), (0, 2), (1, 2), (2, 2)],
    "Pulsar": [(14, 12), (12, 14), (14, 14), (16, 14), (14, 16)],
    "Spaceship": [(0, 1), (1, 2), (2, 0), (2, 1), (2, 2)]
}

# Initialize random pattern
def initialize_random_pattern():
    pattern_name = random.choice(list(PATTERNS.keys()))
    pattern = PATTERNS[pattern_name]
    for x, y in pattern:
        grid[x % GRID_SIZE][y % GRID_SIZE] = 1

# Draw the grid and cells
def draw_grid(surface, grid):
    surface.fill(DEAD_COLOR)
    for x in range(GRID_SIZE):
        for y in range(GRID_SIZE):
            rect = pygame.Rect(y * CELL_SIZE, x * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            if grid[x][y] == 1:
                pygame.draw.rect(surface, CELL_COLOR, rect)
            else:
                pygame.draw.rect(surface, DEAD_COLOR, rect)
            pygame.draw.rect(surface, GRID_COLOR, rect, 1)

# Update grid based on Conway's rules
def update_grid(grid):
    new_grid = [[0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    for x in range(GRID_SIZE):
        for y in range(GRID_SIZE):
            neighbors = count_neighbors(grid, x, y)
            if grid[x][y] == 1 and neighbors in [2, 3]:
                new_grid[x][y] = 1
            elif grid[x][y] == 0 and neighbors == 3:
                new_grid[x][y] = 1
    return new_grid

# Count living neighbors
def count_neighbors(grid, x, y):
    neighbors = 0
    for dx in [-1, 0, 1]:
        for dy in [-1, 0, 1]:
            if dx == 0 and dy == 0:
                continue
            nx, ny = x + dx, y + dy
            if 0 <= nx < GRID_SIZE and 0 <= ny < GRID_SIZE:
                neighbors += grid[nx][ny]
    return neighbors

# Generate random perturbations
def apply_random_perturbations(grid):
    for _ in range(5):  # Randomly toggle 5 cells
        x, y = random.randint(0, GRID_SIZE - 1), random.randint(0, GRID_SIZE - 1)
        grid[x][y] = 1 - grid[x][y]

# Display real-time statistics
def draw_stats(surface, generation, population, population_history):
    font = pygame.font.Font(None, 36)
    stats_surface = pygame.Surface((300, SCREEN_HEIGHT))
    stats_surface.fill((30, 30, 30))
    gen_text = font.render(f"Generation: {generation}", True, STATS_COLOR)
    pop_text = font.render(f"Population: {population}", True, STATS_COLOR)
    stats_surface.blit(gen_text, (10, 10))
    stats_surface.blit(pop_text, (10, 50))
    render_population_trend(stats_surface, population_history)
    surface.blit(stats_surface, (SCREEN_WIDTH, 0))

# Render population trend as a line graph
def render_population_trend(surface, population_history):
    max_population = max(population_history) if population_history else 1
    width, height = surface.get_size()
    for i in range(1, len(population_history)):
        start = (int((i - 1) / len(population_history) * width),
                 int(height - (population_history[i - 1] / max_population) * height))
        end = (int(i / len(population_history) * width),
               int(height - (population_history[i] / max_population) * height))
        pygame.draw.line(surface, (0, 255, 0), start, end, 2)

# Main simulation loop
def main():
    global grid, generation, population_history
    running = True
    paused = True
    speed = 5  # Simulation speed
    initialize_random_pattern()  # Start with a random pattern

    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:  # Toggle pause
                    paused = not paused
                elif event.key == pygame.K_r:  # Reset grid
                    grid = [[0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
                    generation = 0
                    population_history = []
                elif event.key == pygame.K_p:  # Apply random perturbations
                    apply_random_perturbations(grid)

        if not paused:
            grid = update_grid(grid)
            generation += 1
            population = sum(cell for row in grid for cell in row)
            population_history.append(population)

        draw_grid(screen, grid)
        draw_stats(screen, generation, population_history[-1] if population_history else 0, population_history)
        pygame.display.flip()
        clock.tick(FPS + speed)

    pygame.quit()

if __name__ == "__main__":
    main()
