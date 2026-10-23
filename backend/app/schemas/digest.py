from pydantic import BaseModel, Field


class DigestSettingsOut(BaseModel):
    enabled: bool
    sunday_on: bool
    sunday_hour: int
    friday_on: bool
    friday_hour: int

    model_config = {"from_attributes": True}


class DigestSettingsUpdate(BaseModel):
    enabled: bool
    sunday_on: bool
    sunday_hour: int = Field(ge=0, le=23)
    friday_on: bool
    friday_hour: int = Field(ge=0, le=23)


class DigestPreview(BaseModel):
    title: str
    body: str
    sent: int = 0


class DigestFull(BaseModel):
    title: str
    lines: list[str]
