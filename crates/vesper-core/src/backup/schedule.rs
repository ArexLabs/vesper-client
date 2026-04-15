use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct DecimalTime {
    pub hour: u8,
    pub minute: u8,
}

impl DecimalTime {
    pub fn from_decimal(hour: f64) -> Option<Self> {
        let total_minutes = (hour * 60.0).round() as u32;
        if total_minutes >= 24 * 60 {
            return None;
        }
        let h = (total_minutes / 60) as u8;
        let m = (total_minutes % 60) as u8;
        Some(Self { hour: h, minute: m })
    }

    pub fn to_decimal(&self) -> f64 {
        (self.hour as f64) + (self.minute as f64 / 60.0)
    }

    pub fn format24(&self) -> String {
        format!("{:02}:{:02}", self.hour, self.minute)
    }
}

impl fmt::Display for DecimalTime {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.format24())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleType {
    Manual,
    Hourly,
    Daily,
    Weekly,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSchedule {
    pub schedule_type: ScheduleType,
    pub decimal_time: Option<DecimalTime>,
    pub day_of_week: Option<u8>,
    pub enabled: bool,
}

impl Default for BackupSchedule {
    fn default() -> Self {
        Self {
            schedule_type: ScheduleType::Daily,
            decimal_time: Some(DecimalTime { hour: 9, minute: 0 }),
            day_of_week: None,
            enabled: true,
        }
    }
}

impl BackupSchedule {
    pub fn hourly() -> Self {
        Self {
            schedule_type: ScheduleType::Hourly,
            decimal_time: None,
            day_of_week: None,
            enabled: true,
        }
    }

    pub fn daily(time: f64) -> Option<Self> {
        Some(Self {
            schedule_type: ScheduleType::Daily,
            decimal_time: DecimalTime::from_decimal(time),
            day_of_week: None,
            enabled: true,
        })
    }

    pub fn manual() -> Self {
        Self {
            schedule_type: ScheduleType::Manual,
            decimal_time: None,
            day_of_week: None,
            enabled: false,
        }
    }
}