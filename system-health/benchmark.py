import psutil          # For accessing system metrics
import logging         # For logging output to terminal and file
import datetime        # For timestamping the report and log filename

# ----------------------------
# Create a unique log filename using yyyyddMM format
# ----------------------------
current_date = datetime.datetime.now().strftime("%Y%d%m")
log_filename = f"{current_date}_system_health.log"

# ----------------------------
# Logging Configuration
# ----------------------------
logger = logging.getLogger("SystemHealthReport")
logger.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

# Console Handler
ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)
ch.setFormatter(formatter)
logger.addHandler(ch)

# File Handler (overwrite the file each run with a unique filename)
fh = logging.FileHandler(log_filename, mode='w')
fh.setLevel(logging.DEBUG)
fh.setFormatter(formatter)
logger.addHandler(fh)

# ----------------------------
# Main Report Function
# ----------------------------
def generate_report():
    """
    Collects three key system metrics (CPU, Memory, and Disk usage),
    assigns a grade (A, B, or C) for each based on defined thresholds,
    computes an overall grade, and logs the report to both terminal and file.
    """
    now = datetime.datetime.now()
    logger.info("===== System Health Report =====")
    logger.info(f"Report generated on: {now.strftime('%Y-%m-%d %H:%M:%S')}")

    # Gather metrics:
    cpu_usage = psutil.cpu_percent(interval=1)
    mem_usage = psutil.virtual_memory().percent
    disk_usage = psutil.disk_usage('C:\\').percent

    logger.info("System Metrics:")
    logger.info(f"CPU Usage: {cpu_usage}%")
    logger.info(f"Memory Usage: {mem_usage}%")
    logger.info(f"Disk Usage: {disk_usage}%")

    # Helper function to grade a metric using simple thresholds.
    def grade(value, thresholds):
        if value < thresholds[0]:
            return "A"
        elif value < thresholds[1]:
            return "B"
        else:
            return "C"

    # Assign grades using the following thresholds:
    # CPU: A if <30%, B if 30-60%, C otherwise.
    # Memory: A if <50%, B if 50-75%, C otherwise.
    # Disk: A if <40%, B if 40-70%, C otherwise.
    grade_cpu = grade(cpu_usage, (30, 60))
    grade_mem = grade(mem_usage, (50, 75))
    grade_disk = grade(disk_usage, (40, 70))

    logger.info("Metric Grades:")
    logger.info(f"CPU Grade: {grade_cpu}")
    logger.info(f"Memory Grade: {grade_mem}")
    logger.info(f"Disk Grade: {grade_disk}")

    # Compute overall grade:
    # Convert each letter grade to a numeric score (A=3, B=2, C=1),
    # average them, and then assign an overall letter grade.
    grade_mapping = {"A": 3, "B": 2, "C": 1}
    average_score = (grade_mapping[grade_cpu] + grade_mapping[grade_mem] + grade_mapping[grade_disk]) / 3
    if average_score >= 2.67:
        overall_grade = "A"
    elif average_score >= 1.67:
        overall_grade = "B"
    else:
        overall_grade = "C"

    logger.info("Overall System Grade:")
    logger.info(f"Final Grade: {overall_grade}")
    logger.info("===== End of Report =====")

# ----------------------------
# Main Execution
# ----------------------------
if __name__ == "__main__":
    generate_report()
